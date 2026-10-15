import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // Sin .env (CI o contenedor): las variables ya vienen del entorno.
}

const url = process.env.DATABASE_URL_MIGRADOR;
if (!url) throw new Error('Falta la variable DATABASE_URL_MIGRADOR');

// El SQL de db/migrations es la fuente de verdad: Drizzle solo lee el esquema ya
// migrado (drizzle-kit pull) y nunca genera ni aplica migraciones.
export default defineConfig({
  dialect: 'postgresql',
  schemaFilter: ['gesnoc'],
  out: './src/shared/db/esquema',
  dbCredentials: { url },
});
