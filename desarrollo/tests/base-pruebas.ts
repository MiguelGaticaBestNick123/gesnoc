// Las pruebas vacían la base en cada corrida, así que usan una propia en el servidor local y nunca
// tocan los datos de desarrollo ni un host remoto.
import { execSync } from 'node:child_process';
import postgres, { type Sql } from 'postgres';
import { sembrar } from '../db/seeds/demostracion.ts';

const BASE = 'gesnoc_pruebas';
export const CLAVE_PRUEBAS = 'clave-de-pruebas-gesnoc';

export function cargarEntorno() {
  try {
    process.loadEnvFile();
  } catch {
    // Sin .env (CI): las variables ya vienen del entorno.
  }
}

export function urlDePruebas(url: string | undefined): string {
  if (!url) {
    throw new Error('Faltan las URL de la base: revisa .env y `docker compose up -d db migrar`');
  }
  const destino = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(destino.hostname)) {
    throw new Error(`Las pruebas borran datos: no corren contra ${destino.hostname}`);
  }
  destino.pathname = `/${BASE}`;
  return destino.toString();
}

const conectar = (url: URL | string) => postgres(url.toString(), { max: 1, onnotice: () => {} });

export async function asegurarBaseDePruebas() {
  cargarEntorno();
  const urlMigrador = urlDePruebas(process.env.DATABASE_URL_MIGRADOR);
  const urlAdmin = new URL(urlMigrador);
  urlAdmin.username = 'postgres';
  urlAdmin.password = process.env.CLAVE_POSTGRES ?? 'postgres';
  const urlServidor = new URL(urlAdmin);
  urlServidor.pathname = '/postgres';

  const servidor = conectar(urlServidor);
  const [existe] = await servidor`select 1 from pg_database where datname = ${BASE}`;
  if (!existe) {
    await servidor.unsafe(`create database ${BASE}`);
    // La parte de db/roles.sql que es por base; los roles son del servidor y ya existen.
    const base = conectar(urlAdmin);
    await base.unsafe(`
      create schema gesnoc authorization gesnoc_migrador;
      create schema migraciones authorization gesnoc_migrador;
      grant usage on schema gesnoc to gesnoc_app;
      alter default privileges for role gesnoc_migrador in schema gesnoc
        grant select, insert, update, delete on tables to gesnoc_app;
    `);
    await base.end();
  }
  await servidor.end();

  execSync('npm run db:migrar', {
    env: { ...process.env, DATABASE_URL_MIGRADOR: urlMigrador },
    stdio: 'pipe',
  });
}

/** El vaciado se propaga por las claves foráneas a todas las demás tablas. */
export const vaciar = (sql: Sql) => sql`
  truncate gesnoc.usuario, gesnoc.ambiente, gesnoc.noche, gesnoc.cliente, gesnoc.invitado
  restart identity cascade`;

export async function reiniciarBaseDePruebas() {
  await asegurarBaseDePruebas();
  const sql = conectar(urlDePruebas(process.env.DATABASE_URL_MIGRADOR));
  await vaciar(sql);
  await sembrar(sql, CLAVE_PRUEBAS);
  await sql.end();
}
