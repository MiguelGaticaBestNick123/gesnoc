import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

test('el menú del rol abre una sección en construcción', async ({ page }) => {
  await entrarComo(page, 'guardia');
  await page.goto('/guardia/sorteo');
  await expect(page.getByRole('heading', { name: 'Sorteo' })).toBeVisible();
  await expect(page.getByText('HU-37')).toBeVisible();
});

test('la administración llega a la caja y a las pantallas de los otros roles', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/arqueo');
  await expect(page.getByRole('heading', { name: 'Arqueo' })).toBeVisible();
  await expect(page.getByText('HU-28')).toBeVisible();

  await page.goto('/guardia');
  await expect(page.getByRole('heading', { name: 'Entrada', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mi pantalla' })).toHaveAttribute('href', '/admin');
});

test('la carta se abre sin sesión y sin el menú del personal', async ({ page }) => {
  await page.goto('/carta/demo');
  await expect(page.getByRole('heading', { name: 'Carta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
});

test('una sección de otro rol no existe', async ({ page }) => {
  await entrarComo(page, 'cocina');
  const respuesta = await page.goto('/cocina/sorteo');
  expect(respuesta?.status()).toBe(404);
});

test('la barra marca una comanda como lista', async ({ page }) => {
  await entrarComo(page, 'barra');
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
