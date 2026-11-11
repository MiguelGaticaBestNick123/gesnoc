import { expect, test } from '@playwright/test';
import { correoDe } from '../../db/seeds/demostracion';
import { entrarComo, ingresar } from './apoyo';

const pantallas = [
  { persona: 'admin', ruta: '/admin', titulo: 'Resumen de la noche' },
  { persona: 'garzon', ruta: '/garzon', titulo: 'Mesas' },
  { persona: 'barra', ruta: '/barra', titulo: 'Barra Salón' },
  { persona: 'cocina', ruta: '/cocina', titulo: 'Cocina' },
  { persona: 'guardia', ruta: '/guardia', titulo: 'Entrada' },
  { persona: 'sinturno', ruta: '/personal', titulo: 'Mis turnos' },
];

for (const { persona, ruta, titulo } of pantallas) {
  test(`${persona} llega a la pantalla de su turno`, async ({ page }) => {
    await entrarComo(page, persona);
    await expect(page).toHaveURL(new RegExp(`${ruta}$`));
    await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
  });
}

test('sin sesión no se entra a ninguna pantalla', async ({ page }) => {
  for (const ruta of ['/garzon', '/admin/personal', '/personal', '/guardia/sorteo']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/ingresar$/);
  }
});

test('quien no tiene turno solo accede a su calendario (RN-05)', async ({ page }) => {
  await entrarComo(page, 'sinturno');
  for (const ruta of ['/garzon', '/barra', '/guardia', '/admin', '/admin/personal']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/personal$/);
  }
});

test('cada rol vuelve a su pantalla si intenta entrar a otra (RF-04)', async ({ page }) => {
  await entrarComo(page, 'garzon');
  for (const ruta of ['/cocina', '/guardia/sorteo', '/admin/catalogo']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/garzon$/);
  }
});

test('una contraseña errónea muestra el error y conserva el correo', async ({ page }) => {
  await ingresar(page, correoDe('barra'), 'contraseña-equivocada');
  await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible();
  await expect(page.getByLabel('Correo')).toHaveValue(correoDe('barra'));
});

test('no existe registro público (HU-01 CA3)', async ({ page }) => {
  await page.goto('/ingresar');
  await expect(page.getByRole('link')).toHaveCount(0);
});

// Usa una cuenta que ninguna otra prueba ocupa: queda bloqueada 15 minutos.
test('tras cinco intentos fallidos la cuenta se bloquea (HU-01 CA2)', async ({ page }) => {
  const correo = correoDe('apoyo');
  await page.goto('/ingresar');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill('contraseña-equivocada');
  for (let intento = 1; intento <= 4; intento++) {
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Cuenta bloqueada')).toBeVisible();
});

test('la cookie de sesión no es accesible desde el navegador (RNF-02)', async ({
  page,
  context,
}) => {
  await entrarComo(page, 'barra');
  const [cookie] = await context.cookies();
  expect(cookie).toMatchObject({ name: 'gesnoc_sesion', httpOnly: true, sameSite: 'Lax' });
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test('al salir la sesión queda cerrada (HU-02)', async ({ page, context }) => {
  await entrarComo(page, 'cocina');
  const [cookie] = await context.cookies();

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.goto('/cocina');
  await expect(page).toHaveURL(/\/ingresar$/);

  // Aunque alguien conserve la cookie, en el servidor ya no vale.
  await context.addCookies([cookie!]);
  await page.goto('/cocina');
  await expect(page).toHaveURL(/\/ingresar$/);
});

test('con sesión abierta, la pantalla de ingreso lleva a la de su rol', async ({ page }) => {
  await entrarComo(page, 'guardia');
  await page.goto('/ingresar');
  await expect(page).toHaveURL(/\/guardia$/);
});
