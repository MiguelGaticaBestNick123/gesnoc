import { datosBusqueda } from '@/modules/porteria/esquemas';
import { buscar } from '@/modules/porteria/servicios/puerta';
import { leerJson, operar } from '@/shared/rutas';

// HU-30 CA1 y CA2: buscar a una persona por su documento. Va por POST para que el RUT no quede en
// la dirección ni en los registros del servidor (RN-25).
export async function POST(peticion: Request) {
  return operar(async (actor) => {
    const { documento } = datosBusqueda.parse(await leerJson(peticion));
    return buscar(actor, documento);
  });
}
