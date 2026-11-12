import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { bloquearCorrelativo, db, type Conexion, type Transaccion } from '@/shared/db/cliente';
import { cliente, entrada, noche } from '@/shared/db/esquema/schema';

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

/** La invitación de la persona para esta noche, con la lista si viene en una. */
export async function invitacionDe(fecha: string, documento: string) {
  const [fila] = await db().execute<{
    nombre: string;
    apellido: string;
    invitado_por: string | null;
    gratis: boolean;
    lista: string | null;
    responsable: string | null;
  }>(sql`
    select i.nombre, i.apellido, i.invitado_por, coalesce(i.gratis, l.gratis) as gratis,
           l.nombre as lista, l.responsable
    from gesnoc.invitacion i
    left join gesnoc.lista l on l.fecha = i.fecha and l.numero = i.lista_numero
    where i.fecha = ${fecha} and i.documento = ${documento}`);
  return (
    fila && {
      nombre: fila.nombre,
      apellido: fila.apellido,
      invitadoPor: fila.invitado_por,
      gratis: fila.gratis,
      lista: fila.lista,
      responsable: fila.responsable,
    }
  );
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
