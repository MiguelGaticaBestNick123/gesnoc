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

/** «contiene el texto», con los comodines de LIKE (% y _) tomados como letras. */
const patron = (texto: string) => `%${texto.replace(/[!%_]/g, '!$&')}%`;

// Nombre y apellido en minúsculas y sin tildes, para buscar como lo escribe el guardia.
const nombreSinTildes = sql`translate(lower(c.nombre || ' ' || c.apellido),
  'áéíóúüñ', 'aeiouun')`;

/**
 * Clientes cuyo nombre o apellido contiene el texto (ya normalizado: minúsculas y sin tildes), con
 * sus visitas y reportes. No incluye a los anonimizados (RN-25).
 */
export async function buscarPorNombre(texto: string) {
  const filas = await db().execute<{
    documento: string;
    nombre: string;
    apellido: string;
    visitas: number;
    reportes: number;
    expulsado: boolean;
    ultima_visita: string | null;
  }>(sql`
    select c.documento, c.nombre, c.apellido,
           (select count(*)::int from gesnoc.entrada e where e.cliente_id = c.id) as visitas,
           (select count(*)::int from gesnoc.reporte r where r.cliente_id = c.id) as reportes,
           exists (select 1 from gesnoc.reporte r
                   where r.cliente_id = c.id and r.tipo = 'expulsion') as expulsado,
           (select max(e.fecha)::text from gesnoc.entrada e where e.cliente_id = c.id)
             as ultima_visita
    from gesnoc.cliente c
    where c.documento not like 'ANON%'
      and ${nombreSinTildes} like ${patron(texto)} escape '!'
    order by ultima_visita desc nulls last, c.apellido, c.nombre
    limit 20`);
  return filas.map((f) => ({
    documento: f.documento,
    nombre: f.nombre,
    apellido: f.apellido,
    visitas: f.visitas,
    reportes: f.reportes,
    expulsado: f.expulsado,
    ultimaVisita: f.ultima_visita,
  }));
}

/** Corrige el nombre de una ficha; una anonimizada no se toca (RN-25). */
export async function corregirNombre(documento: string, nombre: string, apellido: string) {
  const filas = await db().execute<{ documento: string }>(sql`
    update gesnoc.cliente set nombre = ${nombre}, apellido = ${apellido}
    where documento = ${documento} and documento not like 'ANON%'
    returning documento`);
  return filas.length > 0;
}
