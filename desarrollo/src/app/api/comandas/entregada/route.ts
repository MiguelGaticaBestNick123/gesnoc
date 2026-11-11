import { datosComanda } from '@/modules/venta/esquemas';
import { entregar } from '@/modules/venta/servicios/colas';
import { leerJson, operar } from '@/shared/rutas';

// HU-21: marcar una comanda entregada en la mesa. Repetirlo no registra otra hora.
export async function POST(peticion: Request) {
  return operar(async (actor) => {
    const { pedido, estacionId } = datosComanda.parse(await leerJson(peticion));
    return entregar(actor, pedido, estacionId);
  });
}
