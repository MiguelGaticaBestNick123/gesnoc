import { datosPedido } from '@/modules/venta/esquemas';
import { enviar } from '@/modules/venta/servicios/pedidos';
import { leerJson, operar } from '@/shared/rutas';

// HU-16: enviar un pedido. Es idempotente por la clave de envío: un reintento no lo duplica (RN-13).
export async function POST(peticion: Request) {
  return operar(async (actor) => enviar(actor, datosPedido.parse(await leerJson(peticion))));
}
