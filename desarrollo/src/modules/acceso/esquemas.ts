import { z } from 'zod';
import { identificador, marcado } from '@/shared/esquemas';

const nombre = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(80, 'El nombre admite hasta 80 caracteres');

// HU-03 CA1: el correo siempre se guarda en minúsculas.
const correo = z.string().trim().toLowerCase().pipe(z.email('Ingresa un correo válido'));

const clave = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña admite hasta 128 caracteres');

export const datosIngreso = z.object({
  correo: z.string().trim().toLowerCase().min(1, 'Ingresa tu correo'),
  clave: z.string().min(1, 'Ingresa tu contraseña'),
});

export const datosPersona = z.object({
  nombre,
  correo,
  esAdministrador: marcado,
});
export type DatosPersona = z.output<typeof datosPersona>;

export const datosPersonaNueva = datosPersona.extend({ clave });
export type DatosPersonaNueva = z.output<typeof datosPersonaNueva>;

export const datosEdicion = datosPersona.extend({ id: identificador });

export const datosClave = z.object({ id: identificador, clave });

export const datosActivacion = z.object({ id: identificador, activo: marcado });
