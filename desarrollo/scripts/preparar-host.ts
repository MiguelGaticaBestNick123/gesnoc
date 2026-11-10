// Prepara la base del ambiente publicado (Supabase u otro PostgreSQL 17): npm run host:preparar
//
// Lee `.env.host`, que no se sube al repositorio. Basta con poner ahí HOST_URL_ADMIN, la cadena de
// conexión del usuario administrador. El script genera las claves que falten, crea los roles,
// aplica las migraciones, carga el local de demostración y deja en el mismo archivo la
// DATABASE_URL de la aplicación para copiarla al servicio que la aloja. Nunca muestra claves.
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import postgres from 'postgres';
import { sembrar } from '../db/seeds/demostracion.ts';

const ARCHIVO = '.env.host';
process.loadEnvFile(ARCHIVO);

function clave(nombre: string): string {
  const actual = process.env[nombre];
  if (actual) return actual;
  const nueva = randomBytes(18).toString('base64url');
  appendFileSync(ARCHIVO, `\n${nombre}=${nueva}\n`);
  process.env[nombre] = nueva;
  return nueva;
}

if (!process.env.HOST_URL_ADMIN) throw new Error(`Falta HOST_URL_ADMIN en ${ARCHIVO}`);
const admin = new URL(process.env.HOST_URL_ADMIN);

// En el pooler de Supabase el usuario se escribe «rol.referencia-del-proyecto».
const referencia = decodeURIComponent(admin.username).split('.')[1];
const urlDe = (rol: string, contraseña: string) => {
  const url = new URL(admin);
  url.username = referencia ? `${rol}.${referencia}` : rol;
  url.password = contraseña;
  url.searchParams.set('sslmode', 'require');
  return url.toString();
};

const claveMigrador = clave('CLAVE_MIGRADOR');
const claveApp = clave('CLAVE_APP');
const claveDemo = clave('CLAVE_DEMO');
const urlMigrador = urlDe('gesnoc_migrador', claveMigrador);
const urlApp = urlDe('gesnoc_app', claveApp);

const conectar = (url: string) => postgres(url, { max: 1, onnotice: () => {} });

const sqlAdmin = conectar(admin.toString());
try {
  const [{ version } = { version: '?' }] = await sqlAdmin<{ version: string }[]>`
    select current_setting('server_version') as version`;
  console.log(`PostgreSQL ${version} en ${admin.hostname}`);
  if (!version.startsWith('17')) console.warn('Atención: el proyecto se probó con PostgreSQL 17.');

  const existentes = await sqlAdmin`select 1 from pg_roles where rolname = 'gesnoc_migrador'`;
  if (existentes.length === 0) {
    // roles.sql usa variables de psql; aquí se reemplazan por literales con las comillas escapadas.
    const literal = (texto: string) => `'${texto.replaceAll("'", "''")}'`;
    const script = readFileSync('db/roles.sql', 'utf8')
      .replace(":'clave_migrador'", literal(claveMigrador))
      .replace(":'clave_app'", literal(claveApp));
    await sqlAdmin.unsafe(script);
    console.log('Roles y esquemas creados.');
  } else {
    console.log('Los roles ya existían: se usan las claves guardadas en .env.host.');
  }
} finally {
  await sqlAdmin.end();
}

execSync('npm run db:migrar', {
  env: { ...process.env, DATABASE_URL_MIGRADOR: urlMigrador },
  stdio: ['ignore', 'ignore', 'inherit'],
});
console.log('Migraciones aplicadas.');

const sqlApp = conectar(urlApp);
try {
  const sembrada = await sembrar(sqlApp, claveDemo);
  console.log(
    sembrada ? 'Local de demostración cargado.' : 'La base ya tenía personal: sin cambios.',
  );
} finally {
  await sqlApp.end();
}

if (!readFileSync(ARCHIVO, 'utf8').includes('HOST_DATABASE_URL=')) {
  appendFileSync(
    ARCHIVO,
    `\n# Copiar como DATABASE_URL en el servicio que aloja la aplicación.\nHOST_DATABASE_URL=${urlApp}\n`,
  );
}
console.log(`Listo. Copia HOST_DATABASE_URL de ${ARCHIVO} como DATABASE_URL del servicio.`);
