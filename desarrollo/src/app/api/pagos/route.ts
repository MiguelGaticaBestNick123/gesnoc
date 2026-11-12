import { datosPago } from '@/modules/venta/esquemas';
import { cobrar } from '@/modules/venta/servicios/pagos';
import { leerJson, operar } from '@/shared/rutas';

// HU-24 y HU-25: cobrar un abono. Es idempotente por la clave de envío: un reintento no cobra dos
// veces (RN-13), y ningún pago supera el saldo (RN-18).
export async function POST(peticion: Request) {
  return operar(async (actor) => cobrar(actor, datosPago.parse(await leerJson(peticion))));
}
