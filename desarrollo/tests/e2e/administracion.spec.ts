import { expect, test, type Page } from '@playwright/test';
import { entrarComo, ingresar } from './apoyo';

// Las acciones destructivas piden confirmación con el diálogo del navegador.
const aceptarDialogos = (page: Page) => page.on('dialog', (dialogo) => dialogo.accept());

const modal = (page: Page) => page.getByRole('dialog');

test('HU-03: una cuenta creada entra al sistema y deja de entrar al desactivarla', async ({
  page,
  browser,
}) => {
  aceptarDialogos(page);
  await entrarComo(page, 'admin');
  await page.goto('/admin/personal');

  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await modal(page).getByLabel('Nombre').fill('Marta Lagos');
  await modal(page).getByLabel('Correo').fill('MARTA@gesnoc.test');
  await modal(page).getByLabel('Contraseña inicial').fill('clave-inicial-1');
  await modal(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('marta@gesnoc.test')).toBeVisible();

  const contexto = await browser.newContext();
  const telefono = await contexto.newPage();
  await ingresar(telefono, 'marta@gesnoc.test', 'clave-inicial-1');
  await expect(telefono).toHaveURL(/\/personal$/);

  await page.getByRole('button', { name: 'Desactivar a Marta Lagos' }).click();
  await expect(page.getByText('Desactivada')).toBeVisible();

  await telefono.reload();
  await expect(telefono).toHaveURL(/\/ingresar$/);
  await contexto.close();
});

test('HU-03: un correo repetido se rechaza sin cerrar el formulario', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/personal');

  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await modal(page).getByLabel('Nombre').fill('Repetida');
  await modal(page).getByLabel('Correo').fill('garzon@gesnoc.test');
  await modal(page).getByLabel('Contraseña inicial').fill('clave-inicial-1');
  await modal(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(modal(page).getByRole('alert')).toHaveText('Ya existe una cuenta con ese correo');
  await expect(modal(page).getByLabel('Nombre')).toHaveValue('Repetida');
});

test('HU-04: un ambiente admite una sola barra', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/ambientes');

  await page.getByRole('button', { name: 'Agregar ambiente' }).click();
  await modal(page).getByLabel('Nombre').fill('Patio');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Patio' })).toBeVisible();

  await page.getByRole('button', { name: 'Agregar estación a Patio' }).click();
  await modal(page).getByLabel('Nombre').fill('Barra Patio');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Barra Patio')).toBeVisible();

  await page.getByRole('button', { name: 'Agregar estación a Patio' }).click();
  await modal(page).getByLabel('Nombre').fill('Otra barra');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page).getByRole('alert')).toHaveText('Este ambiente ya tiene una barra');
});

test('HU-06: se agrega un producto y el precio debe ser mayor que cero', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/catalogo');

  await page.getByRole('button', { name: 'Agregar producto' }).click();
  await modal(page).getByLabel('Nombre').fill('Tónica');
  await modal(page).getByLabel('Precio').fill('0');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page).getByRole('alert')).toHaveText(
    'El precio debe ser un monto entero mayor que cero',
  );

  await modal(page).getByLabel('Precio').fill('2500');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Tónica')).toBeVisible();
  await expect(modal(page)).toHaveCount(0);
});

test('HU-06: una categoría fija pide su estación', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/catalogo');
  await page.getByRole('tab', { name: 'Categorías' }).click();

  await page.getByRole('button', { name: 'Agregar categoría' }).click();
  await modal(page).getByLabel('Nombre').fill('Postres');
  await modal(page).getByLabel('Dónde se prepara').selectOption('fija');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page).getByRole('alert')).toHaveText(
    'Elige la estación que prepara esta categoría',
  );

  await modal(page).getByLabel('Estación').selectOption({ label: 'Cocina' });
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Postres')).toBeVisible();
});

test('HU-08 a HU-10: se programa una noche, la persona se declara y queda con turno', async ({
  page,
  browser,
}) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/calendario');

  await page.getByRole('button', { name: 'Programar noche' }).click();
  await modal(page).getByLabel('Fecha operativa').fill('2030-03-15');
  await modal(page).getByLabel('Precio de entrada').fill('4000');
  await modal(page).getByLabel('Nota para el equipo').fill('Aniversario del local');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Aniversario del local')).toBeVisible();

  const contexto = await browser.newContext();
  const telefono = await contexto.newPage();
  await entrarComo(telefono, 'sinturno');
  const noche = 'viernes, 15 de marzo';
  await telefono.getByRole('button', { name: `Puedo trabajar el ${noche}` }).click();
  await expect(telefono.getByRole('button', { name: `Ya no puedo el ${noche}` })).toBeVisible();

  await page.goto('/admin/asignacion?fecha=2030-03-15');
  const lucia = page.locator('.mantine-Card-root', { hasText: 'Lucía Díaz' });
  await expect(lucia.getByText('Disponible')).toBeVisible();
  await page.getByRole('button', { name: 'Asignar turno a Lucía Díaz' }).click();
  await modal(page).getByLabel('Rol').selectOption('garzon');
  await modal(page).getByLabel('Ambiente').selectOption({ label: 'Terraza' });
  await modal(page).getByRole('button', { name: 'Asignar' }).click();
  await expect(lucia.getByText('Garzón · Terraza')).toBeVisible();

  await telefono.reload();
  await expect(telefono.getByText('Turno: Garzón en Terraza')).toBeVisible();
  await contexto.close();
});

test('HU-10: asignar a quien no declaró disponibilidad exige confirmar', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/asignacion');

  await page.getByRole('button', { name: 'Asignar turno a Lucía Díaz' }).click();
  await expect(modal(page).getByText('no declaró disponibilidad')).toBeVisible();
  await modal(page).getByRole('button', { name: 'Asignar' }).click();
  await expect(modal(page).getByText('confirma para asignarla')).toBeVisible();

  await modal(page).getByLabel('Asignar de todos modos').check();
  await modal(page).getByLabel('Rol').selectOption('guardia');
  await expect(modal(page).getByLabel('Ambiente')).toHaveCount(0);
  await modal(page).getByRole('button', { name: 'Asignar' }).click();
  await expect(page.locator('.mantine-Card-root', { hasText: 'Lucía Díaz' })).toContainText(
    'Guardia',
  );
});

test('HU-11: con una noche abierta no se ofrece abrir otra (RN-02)', async ({ page }) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/noche');
  await expect(page.getByText('Abierta', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir noche' })).toHaveCount(0);
});
