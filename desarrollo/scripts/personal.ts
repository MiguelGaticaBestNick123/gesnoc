// Deja en la base el personal del local, con su rol habitual, y desactiva las demás cuentas:
//
//   npm run personal:local   la base local (DATABASE_URL de .env)
//   npm run host:personal    el ambiente publicado (HOST_DATABASE_URL de .env.host)
//
// Las cuentas nuevas entran con la contraseña de CLAVE_DEMO; cada persona la cambia en «Mi
// contraseña». Las que ya existían conservan la suya. Nunca muestra claves.
import postgres from 'postgres';
import { aplicarPersonal } from '../db/seeds/personal.ts';

const enElHost = process.argv.includes('--host');
try {
  process.loadEnvFile(enElHost ? '.env.host' : '.env');
} catch {
  // Sin el archivo: las variables ya vienen del entorno.
}

const url = enElHost ? process.env.HOST_DATABASE_URL : process.env.DATABASE_URL;
const clave = process.env.CLAVE_DEMO;
if (!url || !clave) {
  throw new Error(
    enElHost
      ? 'Faltan HOST_DATABASE_URL o CLAVE_DEMO en .env.host'
      : 'Faltan DATABASE_URL o CLAVE_DEMO en .env',
  );
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const { activas, desactivadas } = await aplicarPersonal(sql, clave);
  console.log(`Personal del local activo (${activas.length}): ${activas.join(', ')}`);
  console.log(
    desactivadas.length > 0
      ? `Cuentas desactivadas (${desactivadas.length}): ${desactivadas.join(', ')}`
      : 'No había otras cuentas activas.',
  );
} finally {
  await sql.end();
}
