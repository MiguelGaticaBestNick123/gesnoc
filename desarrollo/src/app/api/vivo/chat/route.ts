import { estadoDelChat } from '@/modules/chat/servicios/chat';
import { operar } from '@/shared/rutas';

// Chat del personal: los mensajes recientes de los canales de la persona. Se consulta cada 3 s.
export async function GET() {
  return operar((actor) => estadoDelChat(actor));
}
