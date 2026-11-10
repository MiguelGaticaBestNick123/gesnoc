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
    throw error;
  }
}

/** Devuelve la falla prevista como valor, para que la página la muestre en vez de romperse. */
export const capturarFallaPrevista = <T>(operacion: Promise<T>): Promise<T | ErrorDeNegocio> =>
  operacion.catch((falla: unknown) => {
    if (falla instanceof ErrorDeNegocio) return falla;
    throw falla;
  });
