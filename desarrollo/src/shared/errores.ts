/** Falla prevista: su mensaje se muestra tal cual al usuario. */
export class ErrorDeNegocio extends Error {}

export class NoAutorizado extends ErrorDeNegocio {
  constructor() {
    super('No tienes permiso para esta acción');
  }
}

interface ErrorDeBase {
  code?: string;
  constraint_name?: string;
}

export const CLAVE_FORANEA = '23503';

/**
 * Convierte en mensajes las restricciones que hace cumplir la base (unicidad, claves foráneas).
 * Las claves de `mensajes` son nombres de restricción o códigos de error de PostgreSQL.
 */
export async function traducir<T>(
  operacion: PromiseLike<T>,
  mensajes: Record<string, string>,
): Promise<T> {
  try {
    return await operacion;
  } catch (error) {
    // Drizzle envuelve el error del controlador en `cause`.
    const { code, constraint_name: restriccion } = ((error as Error).cause ?? error) as ErrorDeBase;
    const mensaje = mensajes[restriccion ?? ''] ?? mensajes[code ?? ''];
    if (mensaje) throw new ErrorDeNegocio(mensaje);
    throw sinDatosPersonales(error);
  }
}

/**
 * Un error de consulta de Drizzle trae en su mensaje la consulta con sus parámetros (RUT, nombres,
 * hashes), y el del controlador también. Antes de que llegue a los registros del servidor se cambia
 * por uno que solo dice el código de PostgreSQL y la restricción (RNF-11).
 */
export function sinDatosPersonales(falla: unknown): unknown {
  if (!(falla instanceof Error) || !('params' in falla || 'parameters' in falla)) return falla;
  const { code, constraint_name: restriccion } = (falla.cause ?? falla) as ErrorDeBase;
  return new Error(
    `Consulta fallida (${code ?? 'sin código'}${restriccion ? `, ${restriccion}` : ''})`,
  );
}

/** Errores de dato de PostgreSQL (clase 22: número fuera de rango, texto que no es número, etc.). */
export function esDatoInvalido(falla: unknown): boolean {
  if (!(falla instanceof Error)) return false;
  const { code } = (falla.cause ?? falla) as ErrorDeBase;
  return typeof code === 'string' && code.startsWith('22');
}

/** Devuelve la falla prevista como valor, para que la página la muestre en vez de romperse. */
export const capturarFallaPrevista = <T>(operacion: Promise<T>): Promise<T | ErrorDeNegocio> =>
  operacion.catch((falla: unknown) => {
    if (falla instanceof ErrorDeNegocio) return falla;
    throw falla;
  });
