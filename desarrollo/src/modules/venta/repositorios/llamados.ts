import 'server-only';
import { sql } from 'drizzle-orm';
import { db, type Conexion, type Transaccion } from '@/shared/db/cliente';

/** El llamado sin atender de una mesa en la noche; a lo más hay uno (RN-29, `llamado_pendiente_uq`). */
export async function pendienteDeMesa(conexion: Conexion, fecha: string, mesaId: number) {
  const [fila] = await conexion.execute<{ numero: number }>(sql`
    select numero from gesnoc.llamado
    where fecha = ${fecha} and mesa_id = ${mesaId} and atendido_en is null`);
  return fila?.numero;
}

/** Registra un llamado con el siguiente correlativo de la noche (el llamador bloquea antes). */
export async function registrar(tx: Transaccion, fecha: string, mesaId: number) {
  const [fila] = await tx.execute<{ numero: number }>(sql`
    insert into gesnoc.llamado (fecha, numero, mesa_id)
    select ${fecha}, coalesce(max(numero), 0) + 1, ${mesaId}
    from gesnoc.llamado where fecha = ${fecha}
    returning numero`);
  return fila!.numero;
}

export type LlamadoPendiente = {
  numero: number;
  mesa: number;
  ambiente: string;
  /** Segundos desde que el cliente llamó. */
  espera: number;
};

/**
 * HU-40 CA1: los llamados sin atender de la noche, del más antiguo al más nuevo. Con un ambiente,
 * solo los de sus mesas; sin ambiente (la administración), los de todo el local.
 */
export async function pendientes(
  fecha: string,
  ambienteId: number | null,
): Promise<LlamadoPendiente[]> {
  const filas = await db().execute<LlamadoPendiente>(sql`
    select l.numero, m.numero as mesa, a.nombre as ambiente,
           extract(epoch from now() - l.creado_en)::int as espera
    from gesnoc.llamado l
    join gesnoc.mesa m on m.id = l.mesa_id
    join gesnoc.ambiente a on a.id = m.ambiente_id
    where l.fecha = ${fecha} and l.atendido_en is null
      and (${ambienteId}::int is null or m.ambiente_id = ${ambienteId})
    order by l.creado_en, l.numero`);
  return [...filas];
}

/** El ambiente de la mesa que llamó, para decidir quién puede atenderlo (RN-14). */
export async function ambienteDelLlamado(tx: Transaccion, fecha: string, numero: number) {
  const [fila] = await tx.execute<{ ambiente_id: number }>(sql`
    select m.ambiente_id from gesnoc.llamado l join gesnoc.mesa m on m.id = l.mesa_id
    where l.fecha = ${fecha} and l.numero = ${numero}`);
  return fila?.ambiente_id;
}

/** HU-40 CA2: registra quién atendió y cuándo. Uno ya atendido no cambia: conserva al primero. */
export const atender = (tx: Transaccion, fecha: string, numero: number, usuarioId: number) =>
  tx.execute(sql`
    update gesnoc.llamado set atendido_por = ${usuarioId}, atendido_en = now()
    where fecha = ${fecha} and numero = ${numero} and atendido_en is null`);
