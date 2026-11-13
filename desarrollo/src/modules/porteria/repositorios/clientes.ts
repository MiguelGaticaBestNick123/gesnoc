import 'server-only';
import { sql } from 'drizzle-orm';
import { db, type Transaccion } from '@/shared/db/cliente';
import type { TipoReporte } from '../reportes';

/** HU-36 CA1: las noches en que entró, de la más reciente a la más antigua. */
export async function visitasDe(clienteId: number) {
  const filas = await db().execute<{
    fecha: string;
    ticket: number | null;
    medio: string | null;
    registrada_en: string;
  }>(sql`
    select fecha::text as fecha, ticket, medio_pago as medio, registrada_en::text as registrada_en
    from gesnoc.entrada
    where cliente_id = ${clienteId}
    order by fecha desc`);
  return filas.map((f) => ({
    fecha: f.fecha,
    ticket: f.ticket,
    medio: f.medio,
    registradaEn: f.registrada_en,
  }));
}

/** HU-36 CA1: los reportes del cliente, del más reciente al más antiguo, con quién los hizo. */
export async function reportesDe(clienteId: number) {
  const filas = await db().execute<{
    numero: number;
    fecha: string;
    tipo: TipoReporte;
    descripcion: string;
    autor: string;
    registrado_en: string;
  }>(sql`
    select r.numero, r.fecha::text as fecha, r.tipo, r.descripcion, u.nombre as autor,
           r.registrado_en::text as registrado_en
    from gesnoc.reporte r
    join gesnoc.usuario u on u.id = r.registrado_por
    where r.cliente_id = ${clienteId}
    order by r.registrado_en desc, r.numero desc`);
  return filas.map((f) => ({
    numero: f.numero,
    fecha: f.fecha,
    tipo: f.tipo,
    descripcion: f.descripcion,
    autor: f.autor,
    registradoEn: f.registrado_en,
  }));
}

/**
 * Bloquea al cliente hasta el fin de la transacción: dos reportes simultáneos del mismo cliente no
 * toman el mismo número (el correlativo es por cliente, RN-30).
 */
export async function bloquearCliente(tx: Transaccion, clienteId: number) {
  await tx.execute(sql`select id from gesnoc.cliente where id = ${clienteId} for update`);
}

/** HU-35 CA1 (RN-30): el reporte con autor, noche y hora; la base exige los tres. */
export async function insertarReporte(
  tx: Transaccion,
  datos: {
    clienteId: number;
    fecha: string;
    tipo: TipoReporte;
    descripcion: string;
    registradoPor: number;
  },
) {
  const [fila] = await tx.execute<{ numero: number }>(sql`
    insert into gesnoc.reporte (cliente_id, numero, fecha, tipo, descripcion, registrado_por)
    select ${datos.clienteId}, coalesce(max(numero), 0) + 1, ${datos.fecha}, ${datos.tipo},
           ${datos.descripcion}, ${datos.registradoPor}
    from gesnoc.reporte where cliente_id = ${datos.clienteId}
    returning numero`);
  return fila!.numero;
}
