import { defineConfig, devices } from '@playwright/test';

const enCI = Boolean(process.env.CI);
const url = `http://localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: enCI,
  retries: enCI ? 1 : 0,
  reporter: enCI ? 'github' : 'list',
  use: {
    baseURL: url,
    trace: 'on-first-retry',
  },
  // El uso real es en teléfonos: se prueba con un viewport móvil de 360 px (RNF-09).
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: enCI ? 'npm run start' : 'npm run dev',
    url,
    reuseExistingServer: !enCI,
  },
});
