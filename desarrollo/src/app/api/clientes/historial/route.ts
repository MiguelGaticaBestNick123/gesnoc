import { datosBusqueda } from '@/modules/porteria/esquemas';
import { historial } from '@/modules/porteria/servicios/clientes';
import { leerJson, operar } from '@/shared/rutas';

// HU-36: el historial de un cliente por su documento. Va por POST, como la búsqueda de la puerta,
// para que el RUT no quede en la dirección ni en los registros del servidor (RN-25).
export async function POST(peticion: Request) {
  return operar(async (actor) => {
    const { documento } = datosBusqueda.parse(await leerJson(peticion));
    return historial(actor, documento);
  });
}
