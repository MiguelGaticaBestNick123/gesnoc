import { z } from 'zod';
import { llevaAmbiente } from '@/shared/autorizacion';
import { fecha, identificador, marcado, pesos } from '@/shared/esquemas';
import { MENSAJE_DOCUMENTO, normalizarDocumento } from '@/shared/utilidades/rut';
import { duraciones } from './vigencia';

const nota = z
  .string()
  .trim()
  .max(280, 'La nota admite hasta 280 caracteres')
  .transform((texto) => texto || null);

const precioEntrada = pesos('El precio de entrada debe ser un monto entero, cero o más');

export const datosNoche = z.object({ fecha, nota, precioEntrada });
export type DatosNoche = z.output<typeof datosNoche>;

export const conFecha = z.object({ fecha });

export const datosDisponibilidad = z.object({ fecha, disponible: marcado });

export const rolesDeTurno = ['garzon', 'barman', 'cocinero', 'guardia'] as const;

export const datosAsignacion = z
  .object({
    fecha,
    usuarioId: identificador,
    rol: z.enum(rolesDeTurno, 'Elige un rol'),
    ambienteId: z.coerce.number().int().optional(),
    confirmarSinDisponibilidad: marcado,
  })
  .transform(({ ambienteId, ...datos }) => ({
    ...datos,
    // RN-04: cocina y guardia trabajan para todo el local, sin ambiente.
    ambienteId: llevaAmbiente(datos.rol) ? ambienteId || null : null,
  }))
  .refine((datos) => !llevaAmbiente(datos.rol) || datos.ambienteId !== null, {
    message: 'Elige el ambiente del turno',
  });
export type DatosAsignacion = z.output<typeof datosAsignacion>;

export const datosQuitarTurno = z.object({ fecha, usuarioId: identificador });

export const datosApertura = z.object({
  fecha,
  fondo: pesos('El fondo de caja debe ser un monto entero, cero o más'),
});

// Detalles de la noche (pedido del Product Owner, 12 nov): eventos, listas, invitados y premio.

// Un campo que no llegó dice lo mismo que uno vacío: qué falta escribir.
const textoEntre = (minimo: number, maximo: number, falta: string, campo: string) =>
  z
    .string(falta)
    .trim()
    .min(minimo, falta)
    .max(maximo, `${campo} admite hasta ${maximo} caracteres`);

const horaDelEvento = z
  .string()
  .trim()
  .refine((hora) => hora === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(hora), 'Hora no válida')
  .transform((hora) => hora || null);

export const datosEvento = z.object({
  fecha,
  nombre: textoEntre(2, 80, 'Escribe qué evento es', 'El evento'),
  hora: horaDelEvento,
});

export const conNumero = z.object({ fecha, numero: identificador });

export const conId = z.object({ id: identificador });

/**
 * Una lista con su vigencia (pedido del Product Owner, 18 nov): una noche, hasta una fecha o sin
 * término, siempre desde una noche.
 */
export const datosLista = z
  .object({
    // Presente al editar una lista que ya existe.
    id: z.coerce
      .number()
      .int()
      .optional()
      .transform((id) => id || null),
    nombre: textoEntre(2, 60, 'Escribe el nombre de la lista', 'El nombre'),
    responsable: textoEntre(2, 80, 'Escribe quién organiza la lista', 'El responsable'),
    gratis: marcado,
    desde: fecha,
    duracion: z.enum(duraciones, 'Elige cuánto dura la lista'),
    hasta: z.string().optional(),
  })
  .transform(({ duracion, hasta, ...datos }, contexto) => {
    if (duracion === 'noche') return { ...datos, hasta: datos.desde };
    if (duracion === 'siempre') return { ...datos, hasta: null };
    const ultima = fecha.safeParse(hasta ?? '');
    if (!ultima.success) {
      contexto.addIssue({ code: 'custom', message: 'Elige hasta qué noche vale la lista' });
      return z.NEVER;
    }
    if (ultima.data < datos.desde) {
      contexto.addIssue({ code: 'custom', message: 'La lista no puede terminar antes de empezar' });
      return z.NEVER;
    }
    return { ...datos, hasta: ultima.data };
  });
export type DatosLista = z.output<typeof datosLista>;

const tipoDocumento = z.enum(['rut', 'extranjero'], 'Elige el tipo de documento');

/** Nombre, apellido y documento de una persona; el documento se normaliza como el de un cliente (RN-21). */
const persona = z.object({
  tipoDocumento: tipoDocumento.default('rut'),
  documento: z.string(),
  nombre: textoEntre(1, 60, 'Escribe el nombre', 'El nombre'),
  apellido: textoEntre(1, 60, 'Escribe el apellido', 'El apellido'),
});

const conDocumentoNormalizado = <T extends z.output<typeof persona>>(
  { tipoDocumento, ...datos }: T,
  contexto: z.RefinementCtx,
) => {
  const documento = normalizarDocumento(tipoDocumento, datos.documento);
  if (!documento) {
    contexto.addIssue({ code: 'custom', message: MENSAJE_DOCUMENTO[tipoDocumento] });
    return z.NEVER;
  }
  return { ...datos, documento };
};

/** Una persona de una lista: la lista dice si entra gratis. */
export const datosIntegrante = persona
  .extend({ listaId: identificador })
  .transform(conDocumentoNormalizado);
export type DatosIntegrante = z.output<typeof datosIntegrante>;

/** Una persona invitada una noche por alguien, con su propia marca de gratis. */
export const datosInvitacion = persona
  .extend({
    fecha,
    invitadoPor: textoEntre(2, 80, 'Escribe quién la invitó', 'Quién invita'),
    gratis: marcado,
  })
  .transform(conDocumentoNormalizado);
export type DatosInvitacion = z.output<typeof datosInvitacion>;

const documentoGuardado = z.string().min(4).max(20);

export const datosQuitarInvitacion = z.object({ fecha, documento: documentoGuardado });

export const datosQuitarIntegrante = z.object({
  listaId: identificador,
  documento: documentoGuardado,
});

export const datosListaPegada = z.object({
  listaId: identificador,
  texto: z.string().max(20000, 'Pega hasta 200 personas a la vez'),
});

const itemsDelPremio = z
  .string()
  .transform((texto, contexto) => {
    try {
      return JSON.parse(texto) as unknown;
    } catch {
      contexto.addIssue({ code: 'custom', message: 'Premio no válido' });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(
        z.object({
          productoId: z.number().int().positive(),
          cantidad: z
            .number()
            .int('La cantidad va de 1 a 10')
            .min(1, 'La cantidad va de 1 a 10')
            .max(10, 'La cantidad va de 1 a 10'),
        }),
      )
      .max(5, 'El premio admite hasta 5 productos')
      .refine(
        (items) => new Set(items.map((item) => item.productoId)).size === items.length,
        'Un producto aparece dos veces en el premio',
      ),
  );

/** El premio del sorteo de un ambiente: hasta cinco productos del catálogo con su cantidad. */
export const datosPremio = z.object({ fecha, ambienteId: identificador, items: itemsDelPremio });
export type DatosPremio = z.output<typeof datosPremio>;
