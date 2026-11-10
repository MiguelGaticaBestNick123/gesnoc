import { z } from 'zod';

/** Casilla de un formulario: el navegador solo la envía si está marcada. */
export const marcado = z.literal('on').optional().transform(Boolean);

export const identificador = z.coerce.number().int().positive();

const TOPE_PESOS = 100_000_000;

// Del formulario llegan solo dígitos; un «150.000» se rechaza en vez de leerse como 150. Desde una
// operación en JSON llega un número entero.
const montoEntero = (mensaje: string, minimo: number) =>
  z
    .union(
      [
        z.number(),
        z
          .string()
          .trim()
          .regex(/^\d{1,9}$/)
          .transform(Number),
      ],
      { error: mensaje },
    )
    .pipe(z.number().int(mensaje).min(minimo, mensaje).max(TOPE_PESOS, mensaje));

/** RN-24: dinero en pesos enteros, cero o más. */
export const pesos = (mensaje: string) => montoEntero(mensaje, 0);

/** RN-24: dinero en pesos enteros, mayor que cero. */
export const pesosPositivos = (mensaje: string) => montoEntero(mensaje, 1);

export const fecha = z.iso.date('Ingresa una fecha válida');
