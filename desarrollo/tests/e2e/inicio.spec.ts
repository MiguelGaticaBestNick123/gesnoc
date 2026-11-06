import { expect, test } from '@playwright/test';

test('la portada lleva al ingreso en un teléfono', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByRole('heading', { name: 'GesNoc' })).toBeVisible();
});
