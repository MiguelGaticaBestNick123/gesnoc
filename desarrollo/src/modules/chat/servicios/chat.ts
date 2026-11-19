import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import type { Actor } from '@/shared/autorizacion';
import { bloquearCorrelativo } from '@/shared/db/cliente';
import { ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { canalesDe } from '../canales';
import type { DatosMensaje } from '../esquemas';
import * as repositorio from '../repositorios/mensajes';

// Chat del personal (pedido del Product Owner, 18 nov): avisos rápidos durante la noche, al canal
// general o al del rol. Los mensajes son de la noche abierta y se numeran dentro de ella.

/**
 * Lo que ve el chat de una persona: los canales que le tocan y sus mensajes recientes. Sin noche
 * abierta o sin turno no hay canales; no es un error, para que la pantalla no se recargue.
 */
export async function estadoDelChat(actor: Actor) {
  const canales = canalesDe(actor);
  const noche = canales.length > 0 ? ((await fechaAbierta()) ?? null) : null;
  return {
    noche,
    canales: noche ? canales : [],
    mensajes: noche ? await repositorio.mensajesDe(noche, canales) : [],
    yo: actor.id,
  };
}

export type EstadoDelChat = Awaited<ReturnType<typeof estadoDelChat>>;

/**
 * Registra un mensaje en la noche abierta, en un canal de la persona. Si el teléfono reintenta
 * con la misma clave de envío tras un corte, devuelve el mensaje ya registrado (RN-13).
 */
export async function enviarMensaje(actor: Actor, { canal, texto, claveEnvio }: DatosMensaje) {
  return enLaNoche(async (tx, fecha) => {
    if (!canalesDe(actor).includes(canal)) throw new NoAutorizado();
    const previo = await repositorio.porClave(tx, claveEnvio);
    if (previo) {
      if (previo.autorId !== actor.id) {
        throw new ErrorDeNegocio('Esa clave de envío ya se usó en otro mensaje');
      }
      return { numero: previo.numero, repetido: true };
    }
    await bloquearCorrelativo(tx, 'mensaje', fecha);
    const numero = await repositorio.siguienteNumero(tx, fecha);
    await repositorio.insertarMensaje(tx, {
      fecha,
      numero,
      canal,
      autorId: actor.id,
      texto,
      claveEnvio,
    });
    return { numero, repetido: false };
  });
}
