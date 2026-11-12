import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

// Detalles de la noche (pedido del Product Owner, 12 nov): premio, eventos, listas e invitados.

const hoy = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

test('la noche muestra su premio y sus listas, y acepta eventos y listas pegadas', async ({
  page,
}) => {
  await entrarComo(page, 'admin');
  await page.goto(`/admin/calendario?dia=${hoy()}`);
  await expect(page.getByText(/Salón: 1 × Botella de ron añejo/)).toBeVisible();
  await page.getByRole('link', { name: /Ver la noche/ }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/calendario/${hoy()}$`));
  await expect(page.getByText('1 × Botella de pisco 35°')).toBeVisible();

  // Un evento antes de medianoche queda antes del show de la 01:00.
  await page.getByRole('button', { name: 'Agregar evento' }).click();
  await page.getByRole('dialog').getByLabel('Evento').fill('Banda en vivo');
  await page.getByRole('dialog').getByLabel('Hora').fill('23:30');
  await page.getByRole('dialog').getByRole('button', { name: 'Agregar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/^(Banda en vivo|Show de baile|Robot de shots)$/)).toHaveText([
    'Banda en vivo',
    'Show de baile',
    'Robot de shots',
  ]);

  // La lista del cumpleaños se completa pegando lo que mandó la organizadora.
  await page.getByRole('button', { name: 'Lista Cumpleaños de Camila' }).click();
  await page.getByRole('button', { name: 'Pegar personas en Cumpleaños de Camila' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox')
    .fill('22.446.688-9 Rosa Mena\nLucas Díaz, 10987654-2');
  await page.getByRole('dialog').getByRole('button', { name: 'Agregar a la lista' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/22\.446\.688-9/)).toBeVisible();
  await expect(page.getByText('Lucas Díaz', { exact: true })).toBeVisible();
  await expect(page.getByText(/5 personas · organiza Camila Rojas/)).toBeVisible();
});

test('una línea que no se entiende no carga la lista y dice cuál corregir', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto(`/admin/calendario/${hoy()}`);
  await page.getByRole('button', { name: 'Lista Bailarines' }).click();
  await page.getByRole('button', { name: 'Pegar personas en Bailarines' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Sin RUT Ninguno');
  await page.getByRole('dialog').getByRole('button', { name: 'Agregar a la lista' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
    'Línea 1: falta un RUT válido',
  );
});
