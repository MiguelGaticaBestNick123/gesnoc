import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

test('la administración llega a la caja y a las pantallas de los otros roles', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/arqueo');
  await expect(page.getByRole('heading', { name: 'Arqueo' })).toBeVisible();
  await expect(page.getByText('Efectivo esperado')).toBeVisible();

  await page.goto('/guardia');
  await expect(page.getByRole('heading', { name: 'Entrada', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mi pantalla' })).toHaveAttribute('href', '/admin');
});

test('un código de carta desconocido no abre nada ni muestra el menú del personal', async ({
  page,
}) => {
  const respuesta = await page.goto('/carta/codigo-que-no-existe-000000');
  expect(respuesta?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Este código no abre la carta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
});

test('una sección de otro rol no existe', async ({ page }) => {
  await entrarComo(page, 'cocina');
  const respuesta = await page.goto('/cocina/sorteo');
  expect(respuesta?.status()).toBe(404);
});
