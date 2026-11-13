import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

// Corre después de las pruebas de la puerta (proyecto «secuencial»): registra un ingreso, y en
// paralelo cambiaría los conteos que esas pruebas verifican. Entra gratis para no tocar el sorteo.
const RUT = '20.456.789-1';

test('HU-35 y HU-36: el guardia reporta a un cliente y el reporte aparece al buscarlo', async ({
  page,
  browser,
}) => {
  await entrarComo(page, 'guardia');
  await page.goto('/guardia');
  await page.getByRole('textbox', { name: 'Documento' }).fill(RUT);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('textbox', { name: 'Nombre' }).fill('Iván');
  await page.getByRole('textbox', { name: 'Apellido' }).fill('Mora');
  await page.getByRole('button', { name: 'Gratis, sin ticket' }).click();
  await page.getByRole('button', { name: 'Siguiente persona' }).click();

  // HU-35: ya adentro, el guardia lo busca y lo reporta desde la puerta.
  await page.getByRole('textbox', { name: 'Documento' }).fill(RUT);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('Ya entró esta noche')).toBeVisible();
  await page.getByRole('button', { name: 'Historial y reportes' }).click();
  const historial = page.getByRole('dialog', { name: 'Historial y reportes' });
  await expect(historial.getByRole('heading', { name: 'Iván Mora' })).toBeVisible();
  await historial.getByText('Expulsión').click();
  await historial.getByLabel('Qué pasó').fill('Comenzó a buscar pelea en la barra');
  await historial.getByRole('button', { name: 'Guardar reporte' }).click();

  // CA1 (RN-30): queda con tipo, descripción, autor, noche y hora; CA2: no se edita ni se borra.
  const reporte = historial.getByRole('article', { name: 'Reporte 1: Expulsión' });
  await expect(reporte).toBeVisible();
  await expect(reporte.getByText('Comenzó a buscar pelea en la barra')).toBeVisible();
  await expect(reporte.getByText('Por Bruno Pérez')).toBeVisible();
  await expect(reporte.getByRole('button')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // HU-36 CA2: al buscarlo otra vez en la puerta, el reporte aparece sin otro toque.
  await page.getByRole('button', { name: 'Siguiente persona' }).click();
  await page.getByRole('textbox', { name: 'Documento' }).fill(RUT);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: '1 reporte · fue expulsado' }),
  ).toBeVisible();

  // HU-36 CA1: la administración ve sus visitas y sus reportes en «Clientes».
  const contexto = await browser.newContext();
  const admin = await contexto.newPage();
  await entrarComo(admin, 'admin');
  await admin.goto('/admin/clientes');
  await admin.getByRole('textbox', { name: 'Documento' }).fill(RUT);
  await admin.getByRole('button', { name: 'Buscar' }).click();
  await expect(admin.getByRole('heading', { name: 'Iván Mora' })).toBeVisible();
  await expect(admin.getByText(/1 visita · 1 reporte/)).toBeVisible();
  await expect(admin.getByRole('article', { name: 'Reporte 1: Expulsión' })).toBeVisible();
  await contexto.close();
});
