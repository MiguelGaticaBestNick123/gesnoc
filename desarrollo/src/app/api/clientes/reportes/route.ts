import { datosReporte } from '@/modules/porteria/esquemas';
import { reportar } from '@/modules/porteria/servicios/clientes';
import { leerJson, operar } from '@/shared/rutas';

// HU-35: registrar un reporte de un cliente. No hay ruta para editarlo ni borrarlo (RN-30).
export async function POST(peticion: Request) {
  return operar(async (actor) => reportar(actor, datosReporte.parse(await leerJson(peticion))));
}
