import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { bloquearCorrelativo, db } from '@/shared/db/cliente';
import { evento, invitacion, premio } from '@/shared/db/esquema/schema';

/** El premio de cada ambiente, con el nombre del producto, para mostrarlo y copiarlo al sortear. */
export async function premiosDe(fecha: string) {
  const filas = await db().execute<{
    ambiente_id: number;
    ambiente: string;
    producto_id: number;
    producto: string;
    cantidad: number;
  }>(sql`
    select p.ambiente_id, a.nombre as ambiente, p.producto_id, pr.nombre as producto, p.cantidad
    from gesnoc.premio p
    join gesnoc.ambiente a on a.id = p.ambiente_id
    join gesnoc.producto pr on pr.id = p.producto_id
    where p.fecha = ${fecha}
    order by a.nombre, pr.nombre`);
  return filas.map((f) => ({
    ambienteId: f.ambiente_id,
    ambiente: f.ambiente,
    productoId: f.producto_id,
    producto: f.producto,
    cantidad: f.cantidad,
  }));
}

/** Reemplaza el premio de un ambiente en una transacción: nunca queda a medias. */
export function reemplazarPremio(
  fecha: string,
  ambienteId: number,
  items: { productoId: number; cantidad: number }[],
) {
  return db().transaction(async (tx) => {
    await tx.delete(premio).where(and(eq(premio.fecha, fecha), eq(premio.ambienteId, ambienteId)));
    if (items.length > 0) {
      await tx.insert(premio).values(items.map((item) => ({ ...item, fecha, ambienteId })));
    }
  });
}

export const eventosDe = (fecha: string) =>
  db()
    .select({
      numero: evento.numero,
      nombre: evento.nombre,
      hora: sql<string | null>`to_char(${evento.hora}, 'HH24:MI')`,
    })
    .from(evento)
    .where(eq(evento.fecha, fecha))
    .orderBy(asc(evento.numero));

/** Agrega un evento con el siguiente número de la noche; `null` si la noche ya tiene 50. */
export function agregarEvento(fecha: string, nombre: string, hora: string | null) {
  return db().transaction(async (tx) => {
    await bloquearCorrelativo(tx, 'evento', fecha);
    const [ultimo] = await tx
      .select({ numero: sql<number>`coalesce(max(${evento.numero}), 0)::int` })
      .from(evento)
      .where(eq(evento.fecha, fecha));
    const numero = (ultimo?.numero ?? 0) + 1;
    if (numero > 50) return null;
    await tx.insert(evento).values({ fecha, numero, nombre, hora });
    return numero;
  });
}

/** Si el ambiente ya sorteó esta noche: desde entonces su premio queda como se sorteó. */
export async function sorteoHecho(fecha: string, ambienteId: number): Promise<boolean> {
  const [fila] = await db().execute<{ hecho: boolean }>(sql`
    select exists (select 1 from gesnoc.sorteo where fecha = ${fecha} and ambiente_id = ${ambienteId})
      as hecho`);
  return fila?.hecho ?? false;
}

/** Los ambientes que ya sortearon su premio esta noche, con el ticket ganador. */
export async function sorteosDe(fecha: string) {
  const filas = await db().execute<{ ambiente_id: number; ticket: number }>(sql`
    select ambiente_id, ticket_ganador as ticket from gesnoc.sorteo where fecha = ${fecha}`);
  return filas.map((f) => ({ ambienteId: f.ambiente_id, ticket: f.ticket }));
}

export const quitarEvento = (fecha: string, numero: number) =>
  db()
    .delete(evento)
    .where(and(eq(evento.fecha, fecha), eq(evento.numero, numero)))
    .returning({ numero: evento.numero });

/**
 * Las personas invitadas una por una esa noche, con su hora de entrada si ya entraron: la entrada se
 * cruza con la invitación por el documento del cliente.
 */
export async function invitacionesDe(fecha: string) {
  const filas = await db().execute<{
    documento: string;
    nombre: string;
    apellido: string;
    invitado_por: string;
    gratis: boolean;
    entro_en: string | null;
  }>(sql`
    select i.documento, i.nombre, i.apellido, i.invitado_por, i.gratis,
           e.registrada_en::text as entro_en
    from gesnoc.invitacion i
    left join gesnoc.cliente c on c.documento = i.documento
    left join gesnoc.entrada e on e.fecha = i.fecha and e.cliente_id = c.id
    where i.fecha = ${fecha}
    order by i.apellido, i.nombre`);
  return filas.map((f) => ({
    documento: f.documento,
    nombre: f.nombre,
    apellido: f.apellido,
    invitadoPor: f.invitado_por,
    gratis: f.gratis,
    entroEn: f.entro_en,
  }));
}

export type InvitacionDeLaNoche = Awaited<ReturnType<typeof invitacionesDe>>[number];

export const insertarInvitacion = (datos: typeof invitacion.$inferInsert) =>
  db().insert(invitacion).values(datos);

/**
 * Si la persona invitada ya entró esa noche. Su invitación es el único rastro de cómo entró (la
 * entrada se cruza con ella por el documento): no se borra.
 */
export async function yaEntro(fecha: string, documento: string) {
  const [fila] = await db().execute<{ entraron: number }>(sql`
    select count(*)::int as entraron
    from gesnoc.cliente c
    join gesnoc.entrada e on e.fecha = ${fecha} and e.cliente_id = c.id
    where c.documento = ${documento}`);
  return fila?.entraron ?? 0;
}

export const quitarInvitacion = (fecha: string, documento: string) =>
  db()
    .delete(invitacion)
    .where(and(eq(invitacion.fecha, fecha), eq(invitacion.documento, documento)))
    .returning({ documento: invitacion.documento });

/** Lo esencial de los detalles de cada noche del rango, para el calendario. */
export async function detallesDelRango(desde: string, hasta: string) {
  const filas = await db().execute<{
    fecha: string;
    eventos: { nombre: string; hora: string | null }[] | null;
    premios: string[] | null;
    listas: number;
    en_listas: number;
    invitados: number;
  }>(sql`
    select n.fecha::text as fecha,
      (select json_agg(json_build_object('nombre', ev.nombre, 'hora', to_char(ev.hora, 'HH24:MI'))
              order by ev.numero)
         from gesnoc.evento ev where ev.fecha = n.fecha) as eventos,
      (select json_agg(a.nombre || ': ' || p.cantidad || ' × ' || pr.nombre order by a.nombre, pr.nombre)
         from gesnoc.premio p join gesnoc.ambiente a on a.id = p.ambiente_id
         join gesnoc.producto pr on pr.id = p.producto_id where p.fecha = n.fecha) as premios,
      -- Las listas vigentes esa noche: las de esa sola noche y las de varias o sin término.
      (select count(*)::int from gesnoc.lista l
         where l.desde <= n.fecha and (l.hasta is null or l.hasta >= n.fecha)) as listas,
      (select count(*)::int from gesnoc.integrante g join gesnoc.lista l on l.id = g.lista_id
         where l.desde <= n.fecha and (l.hasta is null or l.hasta >= n.fecha)) as en_listas,
      (select count(*)::int from gesnoc.invitacion i where i.fecha = n.fecha) as invitados
    from gesnoc.noche n
    where n.fecha between ${desde} and ${hasta}`);
  return filas.map((f) => ({
    fecha: f.fecha,
    eventos: f.eventos ?? [],
    premios: f.premios ?? [],
    listas: f.listas,
    enListas: f.en_listas,
    invitados: f.invitados,
  }));
}
