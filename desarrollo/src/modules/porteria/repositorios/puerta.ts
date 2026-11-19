import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { bloquearCorrelativo, db, type Conexion, type Transaccion } from '@/shared/db/cliente';
import { cliente, entrada, noche } from '@/shared/db/esquema/schema';
import type { Reconocimiento } from '../reconocimiento';

export async function clientePorDocumento(conexion: Conexion, documento: string) {
  const [fila] = await conexion
    .select({ id: cliente.id, nombre: cliente.nombre, apellido: cliente.apellido })
    .from(cliente)
    .where(eq(cliente.documento, documento));
  return fila;
}

/** La entrada de la persona esta noche, si ya entró (RN-21: una sola). */
export async function entradaDe(conexion: Conexion, fecha: string, clienteId: number) {
  const [fila] = await conexion
    .select({
      ticket: entrada.ticket,
      medio: entrada.medioPago,
      registradaEn: entrada.registradaEn,
    })
    .from(entrada)
    .where(and(eq(entrada.fecha, fecha), eq(entrada.clienteId, clienteId)));
  return fila;
}

/** Cuántas veces vino antes de esta noche: el guardia reconoce a un cliente habitual. */
export async function visitasAnteriores(clienteId: number, fecha: string): Promise<number> {
  const [fila] = await db().execute<{ visitas: number }>(sql`
    select count(*)::int as visitas from gesnoc.entrada
    where cliente_id = ${clienteId} and fecha < ${fecha}`);
  return fila?.visitas ?? 0;
}

/**
 * HU-33: todo lo que trae a la persona esta noche: su invitación individual y las listas vigentes en
 * que está (una de esa noche, una de varias o la de los clientes frecuentes). Al registrar la entrada
 * se piden con `bloquear`: las listas quedan reservadas hasta el fin de la transacción, así nadie
 * elimina ni acorta la lista con que la persona está entrando (HU-33 CA2).
 */
export async function reconocimientos(
  conexion: Conexion,
  fecha: string,
  documento: string,
  bloquear = false,
): Promise<Reconocimiento[]> {
  const invitaciones = await conexion.execute<{
    nombre: string;
    apellido: string;
    invitado_por: string;
    gratis: boolean;
  }>(sql`
    select nombre, apellido, invitado_por, gratis from gesnoc.invitacion
    where fecha = ${fecha} and documento = ${documento}`);
  const listas = await conexion.execute<{
    nombre: string;
    apellido: string;
    lista_id: number;
    lista: string;
    responsable: string;
    gratis: boolean;
    noches: number | null;
  }>(sql`
    select g.nombre, g.apellido, l.id as lista_id, l.nombre as lista, l.responsable, l.gratis,
           l.hasta - l.desde + 1 as noches
    from gesnoc.integrante g
    join gesnoc.lista l on l.id = g.lista_id
    where g.documento = ${documento}
      and l.desde <= ${fecha} and (l.hasta is null or l.hasta >= ${fecha})
    ${bloquear ? sql`for share of l` : sql``}`);
  return [
    ...invitaciones.map((i) => ({
      nombre: i.nombre,
      apellido: i.apellido,
      gratis: i.gratis,
      invitadoPor: i.invitado_por,
      listaId: null,
      lista: null,
      responsable: null,
      noches: null,
    })),
    ...listas.map((l) => ({
      nombre: l.nombre,
      apellido: l.apellido,
      gratis: l.gratis,
      invitadoPor: null,
      listaId: l.lista_id,
      lista: l.lista,
      responsable: l.responsable,
      noches: l.noches,
    })),
  ];
}

export async function precioDeLaNoche(conexion: Conexion, fecha: string): Promise<number> {
  const [fila] = await conexion
    .select({ precio: noche.precioEntrada })
    .from(noche)
    .where(eq(noche.fecha, fecha));
  return fila?.precio ?? 0;
}

/**
 * Serializa los ingresos de la noche hasta el fin de la transacción: así una persona no entra dos
 * veces aunque dos guardias la registren a la vez (RN-21) y los tickets no se repiten ni tienen
 * huecos (RN-22). Cada ingreso dura milisegundos, así que la fila de la puerta no lo nota.
 */
export const bloquearIngresos = (tx: Transaccion, fecha: string) =>
  bloquearCorrelativo(tx, 'ticket', fecha);

/** Registra a una persona nueva; si otra puerta acaba de hacerlo, usa la ya registrada. */
export async function asegurarCliente(
  tx: Transaccion,
  datos: { documento: string; nombre: string; apellido: string },
): Promise<number> {
  const [nuevo] = await tx
    .insert(cliente)
    .values(datos)
    .onConflictDoNothing({ target: cliente.documento })
    .returning({ id: cliente.id });
  if (nuevo) return nuevo.id;
  return (await clientePorDocumento(tx, datos.documento))!.id;
}

export async function siguienteTicket(tx: Transaccion, fecha: string): Promise<number> {
  const [fila] = await tx
    .select({ ultimo: sql<number>`coalesce(max(${entrada.ticket}), 0)::int` })
    .from(entrada)
    .where(eq(entrada.fecha, fecha));
  return (fila?.ultimo ?? 0) + 1;
}

export async function insertarEntrada(tx: Transaccion, datos: typeof entrada.$inferInsert) {
  const [fila] = await tx
    .insert(entrada)
    .values(datos)
    .returning({ registradaEn: entrada.registradaEn });
  return fila!.registradaEn;
}

/**
 * Quiénes entraron esta noche, del más reciente al más antiguo, con lo que el guardia necesita:
 * hora, ticket, nombre, documento y cómo entró. Sin montos: lo recaudado es de la administración.
 */
export async function ingresosDe(fecha: string) {
  const filas = await db().execute<{
    registrada_en: string;
    ticket: number | null;
    medio: string | null;
    nombre: string;
    apellido: string;
    documento: string;
    registro: string;
  }>(sql`
    select e.registrada_en::text as registrada_en, e.ticket, e.medio_pago as medio,
           c.nombre, c.apellido, c.documento, u.nombre as registro
    from gesnoc.entrada e
    join gesnoc.cliente c on c.id = e.cliente_id
    join gesnoc.usuario u on u.id = e.registrada_por
    where e.fecha = ${fecha}
    order by e.registrada_en desc, e.ticket desc nulls last`);
  return filas.map((f) => ({
    registradaEn: f.registrada_en,
    ticket: f.ticket,
    medio: f.medio,
    nombre: f.nombre,
    apellido: f.apellido,
    documento: f.documento,
    registro: f.registro,
  }));
}
