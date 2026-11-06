// Carga el local de demostración: npm run db:semilla
// Usa DATABASE_URL (rol de la aplicación) y toma la contraseña de CLAVE_DEMO.
import postgres from 'postgres';
import { sembrar } from '../db/seeds/demostracion.ts';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: las variables ya vienen del entorno.
}

const { DATABASE_URL: url, CLAVE_DEMO: clave } = process.env;
if (!url || !clave) throw new Error('Faltan DATABASE_URL o CLAVE_DEMO');

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const sembrada = await sembrar(sql, clave);
  console.log(
    sembrada ? 'Local de demostración cargado.' : 'La base ya tenía personal: sin cambios.',
  );
} finally {
  await sql.end();
}
