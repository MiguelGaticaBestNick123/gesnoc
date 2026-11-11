import { datosComanda } from '@/modules/venta/esquemas';
import { marcarLista } from '@/modules/venta/servicios/colas';
import { leerJson, operar } from '@/shared/rutas';

// HU-19: marcar una comanda lista. Repetirlo desde otro dispositivo no registra otra hora.
export async function POST(peticion: Request) {
  return operar(async (actor) => {
    const { pedido, estacionId } = datosComanda.parse(await leerJson(peticion));
    return marcarLista(actor, pedido, estacionId);
  });
}
