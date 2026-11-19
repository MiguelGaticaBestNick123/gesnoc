import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db, type Transaccion } from '@/shared/db/cliente';
import { mensaje } from '@/shared/db/esquema/schema';
import type { Canal } from '../canales';

/** Cuántos mensajes recientes trae cada consulta: lo que cabe en una noche de avisos. */
const RECIENTES = 200;

/**
 * Los últimos mensajes de la noche en esos canales, del más antiguo al más nuevo, con el nombre de
 * quien escribió y su puesto de esa noche (su rol o la administración).
 */
export async function mensajesDe(fecha: string, canales: Canal[]) {
  if (canales.length === 0) return [];
  const filas = await db().execute<{
    numero: number;
    canal: Canal;
    texto: string;
    hora: string;
    autor_id: number;
    autor: string;
    puesto: string | null;
  }>(sql`
    select * from (
      select m.numero, m.canal, m.texto,
             to_char(m.enviado_en at time zone 'America/Santiago', 'HH24:MI') as hora,
             m.autor_id, u.nombre as autor,
             case when u.es_administrador then 'admin' else a.rol end as puesto
      from gesnoc.mensaje m
      join gesnoc.usuario u on u.id = m.autor_id
      left join gesnoc.asignacion a on a.fecha = m.fecha and a.usuario_id = m.autor_id
      where m.fecha = ${fecha} and m.canal in ${canales}
      order by m.numero desc
      limit ${RECIENTES}
    ) recientes
    order by numero`);
  return filas.map(({ autor_id, ...fila }) => ({ ...fila, autorId: autor_id }));
}

export type MensajeDelChat = Awaited<ReturnType<typeof mensajesDe>>[number];

/** El mensaje que ya se registró con esa clave de envío (RN-13): un reintento no lo duplica. */
export async function porClave(tx: Transaccion, claveEnvio: string) {
  const [fila] = await tx
    .select({ numero: mensaje.numero, autorId: mensaje.autorId })
    .from(mensaje)
    .where(eq(mensaje.claveEnvio, claveEnvio));
  return fila;
}

export async function siguienteNumero(tx: Transaccion, fecha: string): Promise<number> {
  const [fila] = await tx.execute<{ ultimo: number }>(sql`
    select coalesce(max(numero), 0)::int as ultimo from gesnoc.mensaje where fecha = ${fecha}`);
  return (fila?.ultimo ?? 0) + 1;
}

export const insertarMensaje = (tx: Transaccion, datos: typeof mensaje.$inferInsert) =>
  tx.insert(mensaje).values(datos);
