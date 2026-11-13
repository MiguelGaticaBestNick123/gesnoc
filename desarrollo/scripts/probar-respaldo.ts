// Comprueba que el último respaldo se puede restaurar: npm run respaldo:probar
//
// Lo restaura en una base aparte, `gesnoc_respaldo`, del PostgreSQL local de Docker (no toca la base
// `gesnoc` del desarrollo ni el publicado) y cuenta las filas de las tablas principales. Necesita la
// base local encendida: docker compose up -d db
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, readdirSync } from 'node:fs';

const BASE = 'gesnoc_respaldo';
const ultimo = readdirSync('respaldos')
  .filter((nombre) => nombre.endsWith('.dump'))
  .sort()
  .at(-1);
if (!ultimo) throw new Error('No hay respaldos en respaldos/: corre npm run host:respaldo');

const enLaBase = (...comando: string[]) => ['compose', 'exec', '-T', 'db', ...comando];

function correr(...comando: string[]) {
  const resultado = spawnSync('docker', enLaBase(...comando), { encoding: 'utf8' });
  if (resultado.status !== 0) {
    throw new Error(
      `Falló «${comando.join(' ')}»: ¿está encendida la base local (docker compose up -d db)?\n${resultado.stderr}`,
    );
  }
  return resultado.stdout;
}

correr('dropdb', '-U', 'postgres', '--if-exists', BASE);
correr('createdb', '-U', 'postgres', BASE);

const restaurar = spawn(
  'docker',
  enLaBase('pg_restore', '-U', 'postgres', '-d', BASE, '--no-owner', '--no-privileges'),
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
createReadStream(`respaldos/${ultimo}`).pipe(restaurar.stdin);

restaurar.on('close', (codigo) => {
  if (codigo !== 0) {
    console.error(`pg_restore terminó con error (${codigo}): el respaldo ${ultimo} no sirve.`);
    process.exitCode = 1;
    return;
  }
  const conteo = correr(
    'psql',
    '-U',
    'postgres',
    '-d',
    BASE,
    '-At',
    '-F',
    ': ',
    '-c',
    `select 'noches', count(*) from gesnoc.noche
     union all select 'personas', count(*) from gesnoc.usuario
     union all select 'mesas', count(*) from gesnoc.mesa
     union all select 'productos', count(*) from gesnoc.producto
     union all select 'cuentas', count(*) from gesnoc.cuenta
     union all select 'pedidos', count(*) from gesnoc.pedido
     union all select 'pagos', count(*) from gesnoc.pago
     union all select 'entradas', count(*) from gesnoc.entrada`,
  );
  console.log(`Respaldo ${ultimo} restaurado en la base local «${BASE}»:\n${conteo}`);
});
