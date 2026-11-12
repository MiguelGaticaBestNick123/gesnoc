import { z } from 'zod';
import { MENSAJE_DOCUMENTO, normalizarDocumento } from '@/shared/utilidades/rut';
import { FORMAS_DE_ENTRADA } from './formas';

const tipoDocumento = z.enum(['rut', 'extranjero'], 'Elige el tipo de documento');

const nombrePropio = (falta: string) =>
  z.string().trim().min(1, falta).max(60, 'Admite hasta 60 caracteres');

/** HU-30 CA1: el documento se valida y se normaliza antes de buscar (RN-21). */
export const datosBusqueda = z
  .object({ tipoDocumento, documento: z.string().max(40) })
  .transform(({ tipoDocumento: tipo, documento }, contexto) => {
    const normalizado = normalizarDocumento(tipo, documento);
    if (!normalizado) {
      contexto.addIssue({ code: 'custom', message: MENSAJE_DOCUMENTO[tipo] });
      return z.NEVER;
    }
    return { documento: normalizado };
  });

/**
 * Una entrada: el documento, el nombre si la persona es nueva, la forma (EF, RC, PN o gratis) y el
 * monto que mostró el teléfono, para no cobrar un precio que cambió mientras el guardia miraba.
 */
export const datosEntrada = z
  .object({
    tipoDocumento,
    documento: z.string().max(40),
    nombre: nombrePropio('Escribe el nombre').optional(),
    apellido: nombrePropio('Escribe el apellido').optional(),
    forma: z.enum(FORMAS_DE_ENTRADA, 'Elige cómo entra: EF, RC, PN o gratis'),
    monto: z.number().int().min(0),
  })
  .transform(({ tipoDocumento: tipo, documento, ...datos }, contexto) => {
    const normalizado = normalizarDocumento(tipo, documento);
    if (!normalizado) {
      contexto.addIssue({ code: 'custom', message: MENSAJE_DOCUMENTO[tipo] });
      return z.NEVER;
    }
    return {
      ...datos,
      documento: normalizado,
      nombre: datos.nombre ?? null,
      apellido: datos.apellido ?? null,
    };
  });
export type DatosEntrada = z.output<typeof datosEntrada>;
