import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));

// `server-only` falla a propósito fuera de Next; acá los servicios corren directo en Node.
const alias = { '@': ruta('./src'), 'server-only': ruta('./tests/vacio.ts') };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        resolve: { alias },
        test: {
          name: 'integracion',
          include: ['tests/integracion/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/integracion/global.ts'],
          setupFiles: ['tests/integracion/entorno.ts'],
          // Comparten una sola base: en serie para que no se pisen los datos.
          fileParallelism: false,
        },
      },
    ],
  },
});
