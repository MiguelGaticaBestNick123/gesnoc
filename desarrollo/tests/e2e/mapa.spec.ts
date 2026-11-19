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

// Pedido del Product Owner (19 nov). Mueve la mesa 12 del Salón sin renumerarla: otras pruebas
// buscan las mesas por su número.
test('el garzón ordena las mesas de su ambiente desde el mapa, sin agregar ni retirar', async ({
  page,
}) => {
  await entrarComo(page, 'garzon');
  await page.goto('/garzon');
  await page.getByRole('link', { name: 'Ordenar mesas' }).click();
  await expect(page.getByRole('heading', { name: 'Ordenar mesas' })).toBeVisible();
  await expect(page.getByText(/^Salón · \d+ mesas/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar mesa' })).toHaveCount(0);

  // Se elige tocándola, cuando React ya terminó de hidratar.
  const mesa = page.getByRole('button', { name: 'Mesa 12', exact: true });
  const panel = page.getByRole('region', { name: 'Mesa elegida' });
  await expect(async () => {
    await mesa.click();
    await expect(panel.getByText('Mesa 12', { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(panel.getByText('Agregar o retirar mesas lo hace la administración.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Retirar mesa' })).toHaveCount(0);

  const centro = mesa.locator('text');
  const antes = (await centro.boundingBox())!;
  await page.mouse.move(antes.x + antes.width / 2, antes.y + antes.height / 2);
  await page.mouse.down();
  await page.mouse.move(antes.x + antes.width / 2 - 40, antes.y + antes.height / 2 - 20, {
    steps: 8,
  });
  await page.mouse.up();
  expect((await centro.boundingBox())!.x).toBeLessThan(antes.x - 10);

  const sillas = panel.getByLabel('Sillas');
  await sillas.fill('4');
  await sillas.blur();
  await page.getByRole('button', { name: 'Guardar plano' }).click();
  await expect(page.getByText('Mesas guardadas: el resto del equipo ya las ve así.')).toBeVisible();

  await page.getByRole('link', { name: 'Volver a las mesas' }).click();
  await expect(page.getByRole('heading', { name: 'Mesas', exact: true })).toBeVisible();
});

// En el teléfono, el navegador tomaba el deslizamiento como un desplazamiento de la página y cortaba
// el arrastre. Aquí se arrastra con eventos táctiles reales de Chrome, sin guardar.
test('con el dedo, la mesa sigue al arrastre y la página no se desplaza', async ({ page }) => {
  await entrarComo(page, 'garzon');
  await page.goto('/garzon/plano');
  const mesa = page.getByRole('button', { name: 'Mesa 10', exact: true });
  const panel = page.getByRole('region', { name: 'Mesa elegida' });
  await expect(async () => {
    await mesa.click();
    await expect(panel.getByText('Mesa 10', { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass();

  const antes = (await mesa.locator('text').boundingBox())!;
  const desplazamiento = await page.evaluate(() => window.scrollY);
  const x = antes.x + antes.width / 2;
  const y = antes.y + antes.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + i * 4, y: y - i * 3 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  expect(await page.evaluate(() => window.scrollY)).toBe(desplazamiento);
  await expect(page.getByRole('button', { name: 'Guardar plano' })).toBeEnabled();
  expect((await mesa.locator('text').boundingBox())!.x).toBeGreaterThan(antes.x + 20);
});
