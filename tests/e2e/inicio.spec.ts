import { expect, test } from '@playwright/test';

test('la página de inicio carga en un teléfono', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GesNoc' })).toBeVisible();
});
