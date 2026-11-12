// Sirve la compilación de producción en este computador: npm run local
//
// `npm run dev` compila cada pantalla la primera vez que se abre y escribe mucho en `.next`; en un
// disco lento eso se nota. Aquí se compila una vez (`next build`) y después todo responde al tiro.
// Escucha en toda la red local: el teléfono entra con la IP de este computador y el puerto 3000.
import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';

process.loadEnvFile('.env');

const destino = '.next/standalone';
if (!existsSync(`${destino}/server.js`)) {
  throw new Error('Falta la compilación: corre `npm run build` o usa `npm run local`');
}
// La compilación autónoma no copia los archivos estáticos: se agregan antes de servir.
cpSync('.next/static', `${destino}/.next/static`, { recursive: true });
if (existsSync('public')) cpSync('public', `${destino}/public`, { recursive: true });

const puerto = process.env.PORT ?? '3000';
console.log(`GesNoc en http://localhost:${puerto} (y en la red local con la IP de este equipo)`);
const servidor = spawn(process.execPath, ['server.js'], {
  cwd: destino,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', PORT: puerto, HOSTNAME: '0.0.0.0' },
});
servidor.on('exit', (codigo) => process.exit(codigo ?? 0));
