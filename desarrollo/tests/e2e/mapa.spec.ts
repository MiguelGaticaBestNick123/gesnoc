import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

// Agrega una mesa nueva en la Terraza sin tocar las mesas 1 a 3, que usan otras pruebas en paralelo.

test('HU-05: la administración agrega, arrastra y renumera una mesa, y el plano queda guardado', async ({
  page,
}) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/mapa');
  await page.getByText('Terraza', { exact: true }).click();
  await expect(page.getByText(/^Terraza · \d+ mesas/)).toBeVisible();

  await page.getByRole('button', { name: 'Agregar mesa' }).click();
  const nueva = page.getByRole('button', { name: 'Mesa 4', exact: true });
  await expect(nueva).toBeVisible();
  // Se toma desde su número, al centro de la mesa, como lo haría el dedo.
  const centro = nueva.locator('text');
  const antes = (await centro.boundingBox())!;

  // CA1: se mueve arrastrándola.
  await page.mouse.move(antes.x + antes.width / 2, antes.y + antes.height / 2);
  await page.mouse.down();
  await page.mouse.move(antes.x + antes.width / 2 + 60, antes.y + antes.height / 2 + 30, {
    steps: 8,
  });
  await page.mouse.up();
  const despues = (await centro.boundingBox())!;
  expect(despues.x).toBeGreaterThan(antes.x + 20);

  // CA2: un número repetido no se puede guardar.
  const numero = page.getByLabel('Número');
  await numero.fill('2');
  await expect(page.getByText('Otra mesa tiene este número')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar plano' })).toBeDisabled();

  await numero.fill('7');
  await page.getByRole('button', { name: 'Guardar plano' }).click();
  await expect(page.getByText('Plano guardado: los garzones ya lo ven así.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Mesa 7', exact: true })).toBeVisible();
});
