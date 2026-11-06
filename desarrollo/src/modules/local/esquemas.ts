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

export const datosEstacion = z.object({
  nombre: nombre(40),
  tipo: z.enum(['barra', 'cocina'], 'La estación debe ser barra o cocina'),
});
export type DatosEstacion = z.output<typeof datosEstacion>;

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
