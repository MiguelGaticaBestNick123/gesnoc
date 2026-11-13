// Saca un respaldo de la base del ambiente publicado: npm run host:respaldo
//
// Deja un archivo en `respaldos/`, fuera de Git porque trae datos de clientes. Usa pg_dump 17 desde la
// imagen de Docker de PostgreSQL (la misma versión de Supabase) con el rol migrador, dueño de las
// tablas. Solo lee: no cambia nada en el publicado. La clave viaja como variable de entorno, nunca en
// la línea de comandos ni en pantalla. Para comprobar que sirve: npm run respaldo:probar
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, statSync } from 'node:fs';

process.loadEnvFile('.env.host');
const { HOST_DATABASE_URL, CLAVE_MIGRADOR } = process.env;
if (!HOST_DATABASE_URL || !CLAVE_MIGRADOR) {
  throw new Error('Faltan HOST_DATABASE_URL o CLAVE_MIGRADOR en .env.host: corre host:preparar');
}

const url = new URL(HOST_DATABASE_URL);
// En el pooler de Supabase el usuario se escribe «rol.referencia-del-proyecto».
const referencia = decodeURIComponent(url.username).split('.')[1];
url.username = referencia ? `gesnoc_migrador.${referencia}` : 'gesnoc_migrador';
url.password = '';

const marca = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Santiago',
  dateStyle: 'short',
  timeStyle: 'short',
})
  .format(new Date())
  .replace(' ', '_')
  .replace(':', '');
mkdirSync('respaldos', { recursive: true });
const archivo = `respaldos/gesnoc-${marca}.dump`;

const pgDump = spawn(
  'docker',
  [
    'run',
    '--rm',
    '-e',
    'PGPASSWORD',
    'postgres:17',
    'pg_dump',
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--schema=gesnoc',
    '--schema=migraciones',
    `--dbname=${url.toString()}`,
  ],
  { env: { ...process.env, PGPASSWORD: CLAVE_MIGRADOR }, stdio: ['ignore', 'pipe', 'inherit'] },
);
const salida = createWriteStream(archivo);
pgDump.stdout.pipe(salida);

pgDump.on('error', () => {
  console.error('No se pudo ejecutar Docker: ¿está abierto Docker Desktop?');
  process.exitCode = 1;
});
pgDump.on('close', (codigo) => {
  if (codigo !== 0) {
    console.error(`pg_dump terminó con error (${codigo}); el archivo ${archivo} no sirve.`);
    process.exitCode = 1;
    return;
  }
  salida.on('finish', () => {
    const kb = Math.round(statSync(archivo).size / 1024);
    console.log(`Respaldo listo: ${archivo} (${kb} KB). Pruébalo con: npm run respaldo:probar`);
  });
});
