import 'server-only';
import { esCodigoDeMesa } from '@/modules/local/carta';
import { mesaDelCodigo } from '@/modules/local/repositorios/carta';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { bloquearCorrelativo } from '@/shared/db/cliente';
import { ErrorDeNegocio } from '@/shared/errores';
import * as llamados from '../repositorios/llamados';

export const CODIGO_SIN_CARTA =
  'Este código ya no abre la carta. Pide ayuda al garzón para ver la carta de tu mesa.';
export const LOCAL_SIN_ATENCION = 'El local no está atendiendo en este momento.';

/**
 * HU-39: el cliente llama al garzón desde la carta, sin sesión; el código del QR es la única llave.
 * CA2 (RN-29): con un llamado pendiente, otro toque no crea otro y recibe la misma confirmación: el
 * cliente hizo lo esperado y no debe ver un error. El correlativo se serializa como los demás de la
 * noche, y el índice único `llamado_pendiente_uq` respalda la regla en la base.
 */
export async function llamar(codigo: string): Promise<{ avisado: true }> {
  if (!esCodigoDeMesa(codigo)) throw new ErrorDeNegocio(CODIGO_SIN_CARTA);
  if (!(await fechaAbierta())) throw new ErrorDeNegocio(LOCAL_SIN_ATENCION);

  return enLaNoche(async (tx, fecha) => {
    const mesa = await mesaDelCodigo(tx, codigo);
    if (!mesa) throw new ErrorDeNegocio(CODIGO_SIN_CARTA);
    await bloquearCorrelativo(tx, 'llamado', fecha);
    if ((await llamados.pendienteDeMesa(tx, fecha, mesa.id)) === undefined) {
      await llamados.registrar(tx, fecha, mesa.id);
    }
    return { avisado: true as const };
  });
}

/**
 * HU-40 CA1: los llamados que ve quien atiende las mesas. El garzón, solo los de su ambiente; la
 * administración, los de todo el local.
 */
export function llamadosPendientes(actor: Actor, fecha: string) {
  exigir(actor, 'garzon');
  return llamados.pendientes(
    fecha,
    actor.esAdministrador ? null : (actor.turno?.ambienteId ?? null),
  );
}

/**
 * HU-40 CA2: marcar un llamado como atendido registra quién y cuándo, y deja de mostrarse. Solo lo
 * atiende un garzón del ambiente de la mesa (RN-14). Repetirlo no cambia nada: si dos garzones tocan
 * a la vez, queda registrado el primero.
 */
export async function atender(actor: Actor, numero: number) {
  exigir(actor, 'garzon');
  return enLaNoche(async (tx, fecha) => {
    const ambienteId = await llamados.ambienteDelLlamado(tx, fecha, numero);
    if (ambienteId === undefined) throw new ErrorDeNegocio('Ese llamado no existe');
    exigir(actor, 'garzon', { ambienteId });
    await llamados.atender(tx, fecha, numero, actor.id);
    return { atendido: true as const };
  });
}
