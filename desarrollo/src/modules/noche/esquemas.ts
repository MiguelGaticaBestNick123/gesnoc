import { z } from 'zod';
import { fecha, identificador, marcado, pesos } from '@/shared/esquemas';

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
    // RN-04: el guardia trabaja en la puerta, sin ambiente.
    ambienteId: datos.rol === 'guardia' ? null : ambienteId || null,
  }))
  .refine((datos) => datos.rol === 'guardia' || datos.ambienteId !== null, {
    message: 'Elige el ambiente del turno',
  });
export type DatosAsignacion = z.output<typeof datosAsignacion>;

export const datosQuitarTurno = z.object({ fecha, usuarioId: identificador });

export const datosApertura = z.object({
  fecha,
  fondo: pesos('El fondo de caja debe ser un monto entero, cero o más'),
});
