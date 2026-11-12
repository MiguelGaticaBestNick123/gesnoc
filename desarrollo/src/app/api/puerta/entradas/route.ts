import { datosEntrada } from '@/modules/porteria/esquemas';
import { registrar } from '@/modules/porteria/servicios/puerta';
import { leerJson, operar } from '@/shared/rutas';

// HU-30: registrar la entrada. Un reintento devuelve la entrada ya registrada con su ticket (RN-21),
// y solo las pagadas reciben ticket (RN-22).
export async function POST(peticion: Request) {
  return operar(async (actor) => registrar(actor, datosEntrada.parse(await leerJson(peticion))));
}
