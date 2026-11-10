import { unstable_rethrow } from 'next/navigation';
import type { EstadoAccion } from '@/shared/acciones';
import { mensajeDeFalla } from '@/shared/red';

export type Accion = (previo: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;

/**
 * Una acción de servidor que se cae en la red lanza una excepción en vez de devolver un error, y la
 * pantalla queda en silencio: la persona cree que no se envió y lo repite. Así vuelve como mensaje.
 * Las redirecciones también llegan como excepción y deben seguir su curso.
 */
export function conManejoDeRed(accion: Accion): Accion {
  return async (previo, datos) => {
    try {
      return await accion(previo, datos);
    } catch (error) {
      unstable_rethrow(error);
      return { error: mensajeDeFalla(error) };
    }
  };
}
