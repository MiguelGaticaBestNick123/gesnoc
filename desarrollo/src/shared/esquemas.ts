import { z } from 'zod';

/** Casilla de un formulario: el navegador solo la envía si está marcada. */
export const marcado = z.literal('on').optional().transform(Boolean);

export const identificador = z.coerce.number().int().positive();

const TOPE_PESOS = 100_000_000;

/** RN-24: dinero en pesos enteros, cero o más. */
export const pesos = (mensaje: string) =>
  z.coerce.number(mensaje).int(mensaje).min(0, mensaje).max(TOPE_PESOS, mensaje);

/** RN-24: dinero en pesos enteros, mayor que cero. */
export const pesosPositivos = (mensaje: string) =>
  z.coerce.number(mensaje).int(mensaje).min(1, mensaje).max(TOPE_PESOS, mensaje);

export const fecha = z.iso.date('Ingresa una fecha válida');
