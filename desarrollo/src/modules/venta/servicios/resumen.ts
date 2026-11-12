import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import * as resumen from '../repositorios/resumen';

/**
 * Portada de la administración: la noche abierta en cifras, al día cada pocos segundos. Se cumple
 * vendido = cobrado + por cobrar (+ cerrado con saldo, cuando exista HU-27), que sirve de control.
 */
export async function resumenDeLaNoche(actor: Actor) {
  exigir(actor, 'admin');
  const fecha = (await fechaAbierta()) ?? null;
  const ambientes = await resumen.porAmbiente(fecha);
  if (!fecha) {
    return { noche: null, cifras: null, ambientes, ultimos: [], masPedidos: [] };
  }
  const [cifras, ultimos, masPedidos] = await Promise.all([
    resumen.cifras(fecha),
    resumen.ultimosPedidos(fecha),
    resumen.masPedidos(fecha),
  ]);
  return { noche: fecha, cifras, ambientes, ultimos, masPedidos };
}

export type ResumenDeLaNoche = Awaited<ReturnType<typeof resumenDeLaNoche>>;
