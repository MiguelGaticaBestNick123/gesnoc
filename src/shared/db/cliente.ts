import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as relations from './esquema/relations';
import * as schema from './esquema/schema';

function crear() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta la variable DATABASE_URL');
  return drizzle(postgres(url, { max: 10 }), { schema: { ...schema, ...relations } });
}

type BaseDeDatos = ReturnType<typeof crear>;

// En desarrollo Next recarga los módulos en cada cambio; guardar la instancia en
// globalThis evita abrir un pool nuevo de conexiones por cada recarga.
const global = globalThis as typeof globalThis & { gesnocDb?: BaseDeDatos };

export function db(): BaseDeDatos {
  global.gesnocDb ??= crear();
  return global.gesnocDb;
}
