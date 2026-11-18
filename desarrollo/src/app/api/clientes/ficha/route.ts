import { datosFicha } from '@/modules/porteria/esquemas';
import { corregirFicha } from '@/modules/porteria/servicios/clientes';
import { leerJson, operar } from '@/shared/rutas';

// La administración corrige el nombre de la ficha de un cliente; el documento no cambia.
export async function POST(peticion: Request) {
  return operar(async (actor) => corregirFicha(actor, datosFicha.parse(await leerJson(peticion))));
}
