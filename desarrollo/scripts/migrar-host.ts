// Aplica las migraciones pendientes a la base del ambiente publicado: npm run host:migrar
//
// Usa el rol migrador con la clave guardada en `.env.host` por `host:preparar`. Hay que correrlo
// antes de subir código que dependa de una migración nueva: si no, la versión publicada consultaría
// columnas que su base todavía no tiene. Nunca muestra claves.
import { execSync } from 'node:child_process';

process.loadEnvFile('.env.host');
const { HOST_DATABASE_URL, CLAVE_MIGRADOR } = process.env;
if (!HOST_DATABASE_URL || !CLAVE_MIGRADOR) {
  throw new Error('Faltan HOST_DATABASE_URL o CLAVE_MIGRADOR en .env.host: corre host:preparar');
}

const url = new URL(HOST_DATABASE_URL);
// En el pooler de Supabase el usuario se escribe «rol.referencia-del-proyecto».
const referencia = decodeURIComponent(url.username).split('.')[1];
url.username = referencia ? `gesnoc_migrador.${referencia}` : 'gesnoc_migrador';
url.password = CLAVE_MIGRADOR;

execSync('npm run db:migrar', {
  env: { ...process.env, DATABASE_URL_MIGRADOR: url.toString() },
  stdio: ['ignore', 'inherit', 'inherit'],
});
