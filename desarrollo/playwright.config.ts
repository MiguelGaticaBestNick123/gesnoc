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
  retries: enCI ? 1 : 0,
  reporter: enCI ? 'github' : 'list',
  use: {
    baseURL: url,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'apertura', testMatch: 'apertura.setup.ts', use: telefono },
    { name: 'movil', dependencies: ['apertura'], use: telefono },
  ],
  webServer: {
    command: enCI ? 'npm run start' : 'npm run dev',
    url,
    reuseExistingServer: false,
    env: { PORT: puerto, DATABASE_URL: urlDePruebas(process.env.DATABASE_URL) },
  },
});
