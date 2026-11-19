import { datosMensaje } from '@/modules/chat/esquemas';
import { enviarMensaje } from '@/modules/chat/servicios/chat';
import { leerJson, operar } from '@/shared/rutas';

// Chat del personal: un mensaje al canal general o al del rol, con su clave de envío (RN-13).
export async function POST(peticion: Request) {
  return operar(async (actor) =>
    enviarMensaje(actor, datosMensaje.parse(await leerJson(peticion))),
  );
}
