import 'server-only';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { bloquearCorrelativo, db } from '@/shared/db/cliente';
import { evento, invitacion, lista, premio } from '@/shared/db/esquema/schema';
import type { PersonaDeLista } from '../listas';

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

export const listasDe = (fecha: string) =>
  db()
    .select({
      numero: lista.numero,
      nombre: lista.nombre,
      responsable: lista.responsable,
      gratis: lista.gratis,
    })
    .from(lista)
    .where(eq(lista.fecha, fecha))
    .orderBy(asc(lista.numero));

interface DatosDeLista {
  nombre: string;
  responsable: string;
  gratis: boolean;
}

/** Crea una lista con el siguiente número de la noche; `null` si ya tiene 99. */
export function agregarLista(fecha: string, datos: DatosDeLista) {
  return db().transaction(async (tx) => {
    await bloquearCorrelativo(tx, 'lista', fecha);
    const [ultima] = await tx
      .select({ numero: sql<number>`coalesce(max(${lista.numero}), 0)::int` })
      .from(lista)
      .where(eq(lista.fecha, fecha));
    const numero = (ultima?.numero ?? 0) + 1;
    if (numero > 99) return null;
    await tx.insert(lista).values({ fecha, numero, ...datos });
    return numero;
  });
}

export const editarLista = (fecha: string, numero: number, datos: DatosDeLista) =>
  db()
    .update(lista)
    .set(datos)
    .where(and(eq(lista.fecha, fecha), eq(lista.numero, numero)))
    .returning({ numero: lista.numero });

// Sus invitaciones caen con ella (on delete cascade); las entradas ya registradas no se tocan.
export const quitarLista = (fecha: string, numero: number) =>
  db()
    .delete(lista)
    .where(and(eq(lista.fecha, fecha), eq(lista.numero, numero)))
    .returning({ numero: lista.numero });

/**
 * Las personas invitadas de la noche, de una lista o individuales, con su hora de entrada si ya
 * entraron: la entrada se cruza con la invitación por el documento del cliente.
 */
export async function invitacionesDe(fecha: string) {
  const filas = await db().execute<{
    documento: string;
    nombre: string;
    apellido: string;
    lista_numero: number | null;
    invitado_por: string | null;
    gratis: boolean | null;
    entro_en: string | null;
  }>(sql`
    select i.documento, i.nombre, i.apellido, i.lista_numero, i.invitado_por, i.gratis,
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
    listaNumero: f.lista_numero,
    invitadoPor: f.invitado_por,
    gratis: f.gratis,
    entroEn: f.entro_en,
  }));
}

export type InvitacionDeLaNoche = Awaited<ReturnType<typeof invitacionesDe>>[number];

export const insertarInvitacion = (datos: typeof invitacion.$inferInsert) =>
  db().insert(invitacion).values(datos);

/** Las personas de una lista pegada, todas o ninguna. */
export const insertarPersonasDeLista = (
  fecha: string,
  listaNumero: number,
  personas: PersonaDeLista[],
) =>
  db()
    .insert(invitacion)
    .values(personas.map((persona) => ({ ...persona, fecha, listaNumero })));

/** Documentos de la lista que ya están invitados esa noche, para avisar cuáles se repiten. */
export async function yaInvitados(fecha: string, documentos: string[]) {
  if (documentos.length === 0) return [];
  const filas = await db()
    .select({ documento: invitacion.documento })
    .from(invitacion)
    .where(and(eq(invitacion.fecha, fecha), inArray(invitacion.documento, documentos)));
  return filas.map((f) => f.documento);
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
      (select count(*)::int from gesnoc.lista l where l.fecha = n.fecha) as listas,
      (select count(*)::int from gesnoc.invitacion i
         where i.fecha = n.fecha and i.lista_numero is not null) as en_listas,
      (select count(*)::int from gesnoc.invitacion i
         where i.fecha = n.fecha and i.lista_numero is null) as invitados
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
