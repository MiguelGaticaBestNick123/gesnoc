import 'server-only';
import { entradasPorForma } from '@/modules/caja/repositorios/caja';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import * as resumen from '../repositorios/resumen';

/**
 * Portada de la administración: la noche abierta en cifras, al día cada pocos segundos, con la puerta
 * (quiénes entraron y cómo pagaron). El control vendido = cobrado + por cobrar + cerrado con saldo
 * está en «Ventas y propinas».
 */
export async function resumenDeLaNoche(actor: Actor) {
  exigir(actor, 'admin');
  const fecha = (await fechaAbierta()) ?? null;
  const ambientes = await resumen.porAmbiente(fecha);
  if (!fecha) {
    return {
      noche: null,
      cifras: null,
      cobros: null,
      puerta: null,
      ambientes,
      ultimos: [],
      masPedidos: [],
    };
  }
  const [cifras, cobros, ultimos, masPedidos, puerta] = await Promise.all([
    resumen.cifras(fecha),
    resumen.cobros(fecha),
    resumen.ultimosPedidos(fecha),
    resumen.masPedidos(fecha),
    entradasPorForma(fecha),
  ]);
  return { noche: fecha, cifras, cobros, puerta, ambientes, ultimos, masPedidos };
}

export type ResumenDeLaNoche = Awaited<ReturnType<typeof resumenDeLaNoche>>;
