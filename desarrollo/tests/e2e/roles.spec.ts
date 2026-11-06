import { expect, test } from '@playwright/test';

const pantallas = [
  { rol: 'Administración', titulo: 'Resumen de la noche' },
  { rol: 'Garzón', titulo: 'Mesas' },
  { rol: 'Barra', titulo: 'Barra Salón' },
  { rol: 'Cocina', titulo: 'Cocina' },
  { rol: 'Guardia', titulo: 'Entrada' },
  { rol: 'Sin turno', titulo: 'Mis turnos' },
];

for (const { rol, titulo } of pantallas) {
  test(`la portada lleva a la pantalla de ${rol}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: `Entrar como ${rol}` }).click();
    await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
  });
}

test('el menú del rol abre una sección en construcción', async ({ page }) => {
  await page.goto('/guardia/sorteo');
  await expect(page.getByRole('heading', { name: 'Sorteo' })).toBeVisible();
  await expect(page.getByText('HU-37')).toBeVisible();
});

test('la administración llega a la caja y a las pantallas de los otros roles', async ({ page }) => {
  await page.goto('/admin/arqueo');
  await expect(page.getByRole('heading', { name: 'Arqueo' })).toBeVisible();
  await expect(page.getByText('HU-28')).toBeVisible();

  await page.goto('/admin');
  await expect(page.locator('a[href="/guardia"]')).toHaveCount(1);
});

test('la carta se abre sin el menú del personal', async ({ page }) => {
  await page.goto('/carta/demo');
  await expect(page.getByRole('heading', { name: 'Carta' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cambiar rol' })).toHaveCount(0);
});

test('una sección de otro rol no existe', async ({ page }) => {
  const respuesta = await page.goto('/cocina/sorteo');
  expect(respuesta?.status()).toBe(404);
});

test('la barra marca una comanda como lista', async ({ page }) => {
  await page.goto('/barra');
  const marcar = page.getByRole('button', { name: 'Marcar lista' }).first();
  await expect(async () => {
    const antes = await page.getByRole('button', { name: 'Marcar lista' }).count();
    await marcar.click();
    await expect(page.getByRole('button', { name: 'Marcar lista' })).toHaveCount(antes - 1, {
      timeout: 1000,
    });
  }).toPass();
});
