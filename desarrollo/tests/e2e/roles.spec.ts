import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

test('el menú del rol abre una sección en construcción', async ({ page }) => {
  await entrarComo(page, 'guardia');
  await page.goto('/guardia/clientes');
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  await expect(page.getByText(/HU-35/)).toBeVisible();
});

test('la administración llega a la caja y a las pantallas de los otros roles', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/arqueo');
  await expect(page.getByRole('heading', { name: 'Arqueo' })).toBeVisible();
  await expect(page.getByText('Efectivo esperado')).toBeVisible();

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
