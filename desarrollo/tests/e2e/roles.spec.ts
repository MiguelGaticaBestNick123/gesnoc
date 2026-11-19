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
  // Pedido del Product Owner (18 nov): al operar como guardia conserva su menú de administración.
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('link', { name: 'Arqueo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Guardia' })).toHaveAttribute('data-active', 'true');
});

test('quien tiene turno y está en otra pantalla ve destacado el camino a la suya', async ({
  page,
}) => {
  await entrarComo(page, 'garzon');
  // Como Diego en la captura del Product Owner: con turno, pero en la sección «Sin turno».
  await page.goto('/personal');
  await expect(page.getByRole('link', { name: 'Mi pantalla: Garzón · Salón' })).toBeVisible();
  // Abajo a la izquierda ya no aparece el nombre de la persona.
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('link', { name: 'Ir a mi pantalla' })).toBeVisible();
  await expect(page.getByText('Diego Soto', { exact: true })).toHaveCount(0);
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

test('la administración ve los indicadores de la noche', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/indicadores');
  await expect(page.getByRole('heading', { name: 'Indicadores' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ventas por hora' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tiempo de preparación' })).toBeVisible();
});

test('la administración revisa la bitácora de la noche', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/bitacora');
  await expect(page.getByRole('heading', { name: 'Bitácora' })).toBeVisible();
  await page.getByRole('button', { name: 'Noche', exact: true }).click();
  await expect(page.getByText('Se abrió la noche')).toBeVisible();
  await page.getByRole('button', { name: 'Puerta', exact: true }).click();
  await expect(page.getByText('Se abrió la noche')).toBeHidden();
});

test('la ayuda «?» explica la pantalla de cada rol', async ({ page }) => {
  await entrarComo(page, 'cocina');
  await page.getByRole('button', { name: 'Ayuda: cómo se usa esta pantalla' }).click();
  await expect(page.getByText('Cómo se usa · Cocina')).toBeVisible();
  await expect(page.getByText(/Una nota en rojo es una alergia/)).toBeVisible();
});
