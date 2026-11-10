// Deja la base local como recién sembrada: npm run db:reiniciar
// Borra todo, así que solo corre contra un servidor local, nunca contra el ambiente publicado.
import postgres from 'postgres';
import { sembrar, vaciar } from '../db/seeds/demostracion.ts';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: las variables ya vienen del entorno.
}

const { DATABASE_URL_MIGRADOR: url, CLAVE_DEMO: clave } = process.env;
if (!url || !clave) throw new Error('Faltan DATABASE_URL_MIGRADOR o CLAVE_DEMO');

const servidor = new URL(url).hostname;
if (!['localhost', '127.0.0.1'].includes(servidor)) {
  throw new Error(`Reiniciar borra todos los datos: no corre contra ${servidor}`);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await vaciar(sql);
  await sembrar(sql, clave);
  console.log('Base local reiniciada con el local de demostración.');
} finally {
  await sql.end();
}
