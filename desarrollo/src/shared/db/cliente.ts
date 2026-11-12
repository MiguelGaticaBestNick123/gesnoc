import 'server-only';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as relations from './esquema/relations';
import * as schema from './esquema/schema';

function crear() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta la variable DATABASE_URL');
  const conexion = postgres(url, {
    max: Number(process.env.DB_CONEXIONES ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(conexion, { schema: { ...schema, ...relations } });
}

type BaseDeDatos = ReturnType<typeof crear>;

/** La conexión dentro de una transacción de Drizzle. */
export type Transaccion = Parameters<Parameters<BaseDeDatos['transaction']>[0]>[0];

/** Una consulta que sirve dentro o fuera de una transacción. */
export type Conexion = Transaccion | BaseDeDatos;

// En desarrollo Next recarga los módulos en cada cambio; guardar la instancia en
// globalThis evita abrir un pool nuevo de conexiones por cada recarga.
const global = globalThis as typeof globalThis & { gesnocDb?: BaseDeDatos };

export function db(): BaseDeDatos {
  global.gesnocDb ??= crear();
  return global.gesnocDb;
}

/**
 * Serializa la asignación de un correlativo de la noche (cuenta, pedido) hasta el fin de la
 * transacción. Junto con la clave primaria evita dos números iguales, el defecto del sistema anterior.
 */
export const bloquearCorrelativo = (tx: Transaccion, correlativo: string, fecha: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${correlativo}:${fecha}`}, 0))`);
