import { expect, test as preparar } from '@playwright/test';
import { entrarComo } from './apoyo';

// Corre antes que las demás pruebas: sin noche abierta nadie tiene turno, y al abrirla (HU-11) cada
// persona pasa a operar el rol que tenía asignado.

preparar('sin noche abierta el turno aún no da acceso (RN-05)', async ({ page }) => {
  await entrarComo(page, 'garzon');
  await expect(page).toHaveURL(/\/personal$/);
  await expect(page.getByRole('heading', { name: 'Mis turnos' })).toBeVisible();
});

preparar('la administración abre la noche con el fondo de caja', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/noche');
  await page.getByLabel('Fondo de caja').fill('50000');
  await page.getByRole('button', { name: 'Abrir noche' }).click();
  await expect(page.getByText('Abierta', { exact: true })).toBeVisible();
  await expect(page.getByText('Fondo de caja $50.000')).toBeVisible();
});
