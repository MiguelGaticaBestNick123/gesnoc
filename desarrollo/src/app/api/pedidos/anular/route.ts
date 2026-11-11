import { datosLinea } from '@/modules/venta/esquemas';
import { anular } from '@/modules/venta/servicios/pedidos';
import { leerJson, operar } from '@/shared/rutas';

// HU-22: anular un ítem de la cuenta, con autor y hora. Repetirlo no cambia nada.
export async function POST(peticion: Request) {
  return operar(async (actor) => anular(actor, datosLinea.parse(await leerJson(peticion))));
}
