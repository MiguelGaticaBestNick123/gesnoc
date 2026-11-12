import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

// Abril de 2030 es solo de esta prueba: otras programan marzo de 2030 en paralelo.

test('HU-08 y HU-09: la administración habilita un día en el calendario y la persona postula en el suyo', async ({
  page,
  browser,
}) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/calendario?mes=2030-04');
  await expect(page.getByText('Abril 2030')).toBeVisible();

  await page.getByRole('button', { name: 'lunes, 15 de abril', exact: true }).click();
  const detalle = page.getByRole('dialog');
  await expect(detalle.getByText('Este día está cerrado')).toBeVisible();
  await detalle.getByLabel('Precio de entrada').fill('3000');
  await detalle.getByRole('button', { name: 'Habilitar este día' }).click();
  await expect(
    page.getByRole('button', { name: /^lunes, 15 de abril, noche programada/ }),
  ).toBeVisible();

  const contexto = await browser.newContext();
  const telefono = await contexto.newPage();
  await entrarComo(telefono, 'sinturno');
  await telefono.goto('/personal?mes=2030-04');
  await telefono.getByRole('button', { name: 'lunes, 15 de abril, puedes postular' }).click();
  await telefono.getByRole('button', { name: 'Puedo trabajar esta noche' }).click();
  await expect(
    telefono.getByRole('button', { name: 'lunes, 15 de abril, postulaste' }),
  ).toBeVisible();
  await contexto.close();

  // La administración ve la postulación en el día.
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: /^lunes, 15 de abril, noche programada, 0 con turno, 1 postulan/,
    }),
  ).toBeVisible();
});

test('HU-10: al asignar un rol se recomiendan primero quienes lo hacen habitualmente', async ({
  page,
}) => {
  page.on('dialog', (dialogo) => dialogo.accept());
  await entrarComo(page, 'admin');
  await page.goto('/admin/asignacion');

  await page.getByRole('radiogroup').getByText('Guardia', { exact: true }).click();
  await expect(page.getByText('Suelen hacer de Guardia:')).toBeVisible();
  const tarjetas = page.locator('.mantine-Card-root');
  // Bruno ya es guardia esta noche; Lucía suele serlo aunque hoy no tenga turno.
  await expect(tarjetas.nth(0)).toContainText('Bruno Pérez');
  await expect(tarjetas.nth(1)).toContainText('Lucía Díaz');
  await expect(tarjetas.nth(1)).toContainText('Suele ser Guardia');

  // Un toque asigna; como Rocío no postuló, se confirma antes.
  await page.getByRole('button', { name: 'Asignar a Rocío Paredes como Guardia' }).click();
  await expect(
    page.locator('.mantine-Card-root', { hasText: 'Rocío Paredes' }).getByText('Guardia', {
      exact: true,
    }),
  ).toBeVisible();
});
