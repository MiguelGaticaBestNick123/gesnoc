import { datosBusquedaNombre } from '@/modules/porteria/esquemas';
import { buscarClientes } from '@/modules/porteria/servicios/clientes';
import { leerJson, operar } from '@/shared/rutas';

// Buscar clientes por nombre o apellido. Va por POST, como la búsqueda por documento (RN-25).
export async function POST(peticion: Request) {
  return operar(async (actor) => {
    const { texto } = datosBusquedaNombre.parse(await leerJson(peticion));
    return buscarClientes(actor, texto);
  });
}
