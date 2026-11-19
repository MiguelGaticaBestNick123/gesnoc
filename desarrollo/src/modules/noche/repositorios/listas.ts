import 'server-only';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { bloquearCorrelativo, db, type Conexion, type Transaccion } from '@/shared/db/cliente';
import { cliente, entrada, integrante, lista } from '@/shared/db/esquema/schema';
import type { PersonaDeLista } from '../listas';
import type { Vigencia } from '../vigencia';

// Listas con vigencia (pedido del Product Owner, 18 nov): de una noche, de varias o sin término.

export interface DatosDeLista extends Vigencia {
  nombre: string;
  responsable: string;
  gratis: boolean;
}

const columnas = {
  id: lista.id,
  nombre: lista.nombre,
  responsable: lista.responsable,
  gratis: lista.gratis,
  desde: lista.desde,
  hasta: lista.hasta,
};

/**
 * Las listas vigentes la noche de `fecha`: primero las de esa sola noche y al final las que no tienen
 * término, como la de los clientes frecuentes.
 */
export const vigentesEn = (fecha: string) =>
  db()
    .select(columnas)
    .from(lista)
    .where(
      sql`${lista.desde} <= ${fecha} and (${lista.hasta} is null or ${lista.hasta} >= ${fecha})`,
    )
    .orderBy(sql`${lista.hasta} - ${lista.desde} nulls last`, asc(lista.nombre));

/** Las listas que todavía valen desde `hoy`: las vigentes y las que vienen. */
export const vigentesDesde = (hoy: string) =>
  db()
    .select(columnas)
    .from(lista)
    .where(sql`${lista.hasta} is null or ${lista.hasta} >= ${hoy}`)
    .orderBy(asc(lista.desde), sql`${lista.hasta} nulls last`, asc(lista.nombre));

export type ListaGuardada = Awaited<ReturnType<typeof vigentesEn>>[number];

/**
 * Las personas de esas listas. Con una noche, cada una trae la hora en que entró esa noche: la
 * entrada se cruza con la persona por el documento del cliente.
 */
export function integrantesDe(listaIds: number[], noche: string | null) {
  const personas = {
    listaId: integrante.listaId,
    documento: integrante.documento,
    nombre: integrante.nombre,
    apellido: integrante.apellido,
  };
  const orden = [asc(integrante.apellido), asc(integrante.nombre)];
  const deLasListas = inArray(integrante.listaId, listaIds.length > 0 ? listaIds : [0]);
  if (noche === null) {
    return db()
      .select({ ...personas, entroEn: sql<string | null>`null` })
      .from(integrante)
      .where(deLasListas)
      .orderBy(...orden);
  }
  return db()
    .select({ ...personas, entroEn: sql<string | null>`${entrada.registradaEn}::text` })
    .from(integrante)
    .leftJoin(cliente, eq(cliente.documento, integrante.documento))
    .leftJoin(entrada, and(eq(entrada.fecha, noche), eq(entrada.clienteId, cliente.id)))
    .where(deLasListas)
    .orderBy(...orden);
}

export type Integrante = Awaited<ReturnType<typeof integrantesDe>>[number];

/** Una lista; `bloquear` la reserva hasta el fin de la transacción para cambiarla o quitarla. */
export async function buscarLista(conexion: Conexion, id: number, bloquear = false) {
  const consulta = conexion.select(columnas).from(lista).where(eq(lista.id, id));
  const [fila] = bloquear ? await consulta.for('update') : await consulta;
  return fila;
}

/**
 * Las entradas que la puerta registró con esta lista, con la primera y la última noche: la
 * vigencia de una lista usada debe seguir incluyéndolas (HU-33 CA2).
 */
export async function usosDe(conexion: Conexion, id: number) {
  const [fila] = await conexion.execute<{
    entradas: number;
    primera: string | null;
    ultima: string | null;
  }>(sql`
    select count(*)::int as entradas, min(fecha)::text as primera, max(fecha)::text as ultima
    from gesnoc.entrada where lista_id = ${id}`);
  return {
    entradas: fila?.entradas ?? 0,
    primera: fila?.primera ?? null,
    ultima: fila?.ultima ?? null,
  };
}

/**
 * Los cambios de listas se hacen de a uno. Así dos listas que comparten alguna noche no quedan con
 * el mismo nombre aunque dos personas las guarden a la vez.
 */
export const bloquearListas = (tx: Transaccion) => bloquearCorrelativo(tx, 'lista', 'nombre');

/** Si otra lista con ese nombre vale alguna de esas noches. */
export async function nombreOcupado(
  tx: Transaccion,
  nombre: string,
  { desde, hasta }: Vigencia,
  excepto: number | null,
): Promise<boolean> {
  const [fila] = await tx.execute<{ ocupado: boolean }>(sql`
    select exists (
      select 1 from gesnoc.lista
      where lower(trim(nombre)) = lower(trim(${nombre}))
        and id <> ${excepto ?? 0}
        and desde <= coalesce(${hasta}::date, 'infinity')
        and coalesce(hasta, 'infinity') >= ${desde}::date
    ) as ocupado`);
  return fila?.ocupado ?? false;
}

export async function insertarLista(tx: Transaccion, datos: DatosDeLista): Promise<number> {
  const [fila] = await tx.insert(lista).values(datos).returning({ id: lista.id });
  return fila!.id;
}

export const actualizarLista = (tx: Transaccion, id: number, datos: Partial<DatosDeLista>) =>
  tx.update(lista).set(datos).where(eq(lista.id, id));

// Sus integrantes caen con ella (on delete cascade). Solo se elimina una lista que nadie usó.
export const eliminarLista = (tx: Transaccion, id: number) =>
  tx.delete(lista).where(eq(lista.id, id));

/** Al eliminar una noche que no se abrió, sus listas de esa sola noche se van con ella. */
export const eliminarListasDeLaNoche = (tx: Transaccion, fecha: string) =>
  tx.delete(lista).where(and(eq(lista.desde, fecha), eq(lista.hasta, fecha)));

export const insertarIntegrante = (datos: typeof integrante.$inferInsert) =>
  db().insert(integrante).values(datos);

/** Las personas de una lista pegada, todas o ninguna. */
export const insertarIntegrantes = (listaId: number, personas: PersonaDeLista[]) =>
  db()
    .insert(integrante)
    .values(personas.map((persona) => ({ ...persona, listaId })));

/** Documentos que ya están en la lista, para avisar cuáles se repiten. */
export async function yaEnLaLista(listaId: number, documentos: string[]) {
  if (documentos.length === 0) return [];
  const filas = await db()
    .select({ documento: integrante.documento })
    .from(integrante)
    .where(and(eq(integrante.listaId, listaId), inArray(integrante.documento, documentos)));
  return filas.map((f) => f.documento);
}

export const quitarIntegrante = (listaId: number, documento: string) =>
  db()
    .delete(integrante)
    .where(and(eq(integrante.listaId, listaId), eq(integrante.documento, documento)))
    .returning({ documento: integrante.documento });
