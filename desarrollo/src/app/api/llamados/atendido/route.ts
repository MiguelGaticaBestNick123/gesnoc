import { datosLlamado } from '@/modules/venta/esquemas';
import { atender } from '@/modules/venta/servicios/llamados';
import { leerJson, operar } from '@/shared/rutas';

// HU-40: el garzón marca atendido el llamado de una mesa. Repetirlo no registra otra hora.
export async function POST(peticion: Request) {
  return operar(async (actor) => {
    const { numero } = datosLlamado.parse(await leerJson(peticion));
    return atender(actor, numero);
  });
}
