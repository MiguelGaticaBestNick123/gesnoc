import { z } from 'zod';
import { identificador, marcado, pesosPositivos } from '@/shared/esquemas';

const nombre = (maximo: number) =>
  z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(maximo, `El nombre admite hasta ${maximo} caracteres`);

const tamanoPlano = (eje: string) =>
  z.coerce
    .number()
    .int(`El ${eje} del plano debe ser un número entero`)
    .min(200, `El ${eje} del plano debe ser de al menos 200`)
    .max(5000, `El ${eje} del plano admite hasta 5000`);

export const datosAmbiente = z.object({
  nombre: nombre(40),
  planoAncho: tamanoPlano('ancho'),
  planoAlto: tamanoPlano('alto'),
});
export type DatosAmbiente = z.output<typeof datosAmbiente>;

/**
 * Una estación nueva: la barra es de un ambiente (a lo más una, RN-27); la cocina es de todo el
 * local y recibe la comida de todos los ambientes (decisión del Product Owner, 12 nov).
 */
export const datosEstacion = z
  .object({
    nombre: nombre(40),
    tipo: z.enum(['barra', 'cocina'], 'La estación debe ser barra o cocina'),
    ambienteId: z.coerce.number().int().optional(),
  })
  .transform(({ ambienteId, ...datos }) => ({
    ...datos,
    ambienteId: datos.tipo === 'barra' ? ambienteId || null : null,
  }))
  .refine((datos) => datos.tipo === 'cocina' || datos.ambienteId !== null, {
    message: 'Elige el ambiente de la barra',
  });
export type DatosEstacion = z.output<typeof datosEstacion>;

/** Al editar una estación solo cambia su nombre: el tipo y el ambiente se fijan al crearla. */
export const datosNombreEstacion = z.object({ nombre: nombre(40) });

export const datosCategoria = z
  .object({
    nombre: nombre(40),
    reglaRuteo: z.enum(['fija', 'barra_ambiente'], 'Elige dónde se preparan estos productos'),
    estacionId: z.coerce.number().int().optional(),
  })
  .transform(({ nombre, reglaRuteo, estacionId }) => ({
    nombre,
    reglaRuteo,
    // La barra del ambiente se resuelve al pedir; solo la regla fija guarda una estación.
    estacionId: reglaRuteo === 'fija' ? estacionId || null : null,
  }))
  .refine((datos) => datos.reglaRuteo !== 'fija' || datos.estacionId !== null, {
    message: 'Elige la estación que prepara esta categoría',
  });
export type DatosCategoria = z.output<typeof datosCategoria>;

export const datosProducto = z.object({
  nombre: nombre(80),
  precio: pesosPositivos('El precio debe ser un monto entero mayor que cero'),
  categoriaId: identificador,
  // Vacío: sigue la regla de su categoría (RN-10).
  estacionId: z.coerce
    .number()
    .int()
    .transform((id) => id || null),
});
export type DatosProducto = z.output<typeof datosProducto>;

export const conId = z.object({ id: identificador });

export const datosActivacion = z.object({ id: identificador, activo: marcado });

const enteroEntre = (minimo: number, maximo: number, mensaje: string) =>
  z.number(mensaje).int(mensaje).min(minimo, mensaje).max(maximo, mensaje);

/** Una mesa tal como la deja el editor; sin `id` es una mesa nueva (HU-05). */
const mesaDelPlano = z
  .object({
    id: z.number().int().positive().optional(),
    numero: enteroEntre(1, 999, 'El número de mesa va de 1 a 999'),
    forma: z.enum(['cuadrada', 'redonda', 'rectangular'], 'Forma de mesa no válida'),
    posX: enteroEntre(0, 5000, 'La mesa quedó fuera del plano'),
    posY: enteroEntre(0, 5000, 'La mesa quedó fuera del plano'),
    ancho: enteroEntre(20, 400, 'El tamaño de una mesa va de 20 a 400'),
    alto: enteroEntre(20, 400, 'El tamaño de una mesa va de 20 a 400'),
    rotacion: enteroEntre(0, 359, 'La rotación va de 0 a 359 grados'),
    // Sillas fijas; sin valor, el plano dibuja las que caben según el tamaño.
    sillas: enteroEntre(0, 20, 'Una mesa admite de 0 a 20 sillas')
      .nullable()
      .optional()
      .transform((sillas) => sillas ?? null),
  })
  // Una mesa cuadrada o redonda tiene ancho y alto iguales (mesa_proporcion_ck).
  .transform((mesa) => (mesa.forma === 'rectangular' ? mesa : { ...mesa, alto: mesa.ancho }));

export const datosPlano = z.object({
  ambienteId: z.number().int().positive(),
  mesas: z.array(mesaDelPlano).max(200, 'Un ambiente admite hasta 200 mesas'),
  retiradas: z.array(z.number().int().positive()).max(200),
});
export type DatosPlano = z.output<typeof datosPlano>;
export type MesaDelPlano = DatosPlano['mesas'][number];
