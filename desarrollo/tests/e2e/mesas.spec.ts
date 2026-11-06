import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './apoyo';

// El mapa se renderiza en el servidor y recién responde a los toques cuando React
// termina de hidratar; por eso el toque se reintenta hasta que el panel aparece.
async function tocarMesa(page: Page, nombre: string, esperado: string) {
  await expect(async () => {
    await page.getByRole('button', { name: nombre }).click();
    await expect(page.getByText(esperado, { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test('el mapa muestra las mesas del ambiente y la cuenta de una mesa ocupada', async ({ page }) => {
  await entrarComo(page, 'garzon');
  await expect(page.getByRole('heading', { name: 'Mesas' })).toBeVisible();

  await tocarMesa(page, 'Mesa 4, ocupada', 'Cuenta 12');
  await expect(page.getByText('Pedido 57')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cobrar' })).toBeVisible();

  await tocarMesa(page, 'Mesa 1, libre', 'Libre');
  await expect(page.getByRole('button', { name: 'Abrir cuenta' })).toBeVisible();
});
