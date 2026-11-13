import { defineConfig, devices } from '@playwright/test';
import { cargarEntorno, urlDePruebas } from './tests/base-pruebas';

cargarEntorno();

const enCI = Boolean(process.env.CI);
const puerto = process.env.PORT ?? '3100';
const url = `http://localhost:${puerto}`;

// El uso real es en teléfonos: se prueba con un viewport móvil de 360 px (RNF-09).
const telefono = { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } };

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global.ts',
  forbidOnly: enCI,
  // Sin reintentos: las pruebas comparten la noche, y un reintento falla por otra razón.
  retries: 0,
  reporter: enCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: url,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'apertura', testMatch: 'apertura.setup.ts', use: telefono },
    { name: 'movil', dependencies: ['apertura'], use: telefono },
    // Las pruebas que no pueden convivir con otras (el llamado de una mesa avisa en todas las pantallas
    // del garzón) corren solas, después de las demás.
    { name: 'secuencial', testMatch: '*.secuencial.ts', dependencies: ['movil'], use: telefono },
    // El cierre de la noche va al final: con la noche cerrada, las demás pruebas no podrían operar.
    { name: 'cierre', testMatch: 'cierre.final.ts', dependencies: ['secuencial'], use: telefono },
  ],
  webServer: {
    command: enCI ? 'npm run start' : 'npm run dev',
    url,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PORT: puerto, DATABASE_URL: urlDePruebas(process.env.DATABASE_URL) },
  },
});
