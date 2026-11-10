import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './apoyo';

// Cada prueba usa mesas distintas del Salón: corren en paralelo sobre la misma noche abierta.

async function abrirMesa(page: Page, numero: number) {
  await page.goto('/garzon');
  // El mapa responde a los toques recién cuando React termina de hidratar.
  await expect(async () => {
    await page.getByRole('button', { name: `Mesa ${numero}, libre` }).click();
    await expect(page.getByRole('button', { name: 'Abrir cuenta' })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  await page.getByRole('button', { name: 'Abrir cuenta' }).click();
  await expect(page).toHaveURL(/\/garzon\/cuenta\/\d+$/);
  await expect(page.getByRole('heading', { name: `Mesa ${numero}` })).toBeVisible();
}

const agregar = (page: Page, producto: string) =>
  page.getByRole('button', { name: `Agregar ${producto}` }).click();

const enviar = (page: Page) => page.getByRole('button', { name: /^Enviar ·/ }).click();

test('HU-13: la mesa ocupada en un teléfono se ve en el otro en 5 segundos o menos', async ({
  page,
  browser,
}) => {
  const contexto = await browser.newContext();
  const otroTelefono = await contexto.newPage();
  await entrarComo(otroTelefono, 'garzon');
  await expect(otroTelefono.getByRole('button', { name: 'Mesa 9, libre' })).toBeVisible();

  await entrarComo(page, 'garzon');
  await abrirMesa(page, 9);

  await expect(otroTelefono.getByRole('button', { name: 'Mesa 9, ocupada' })).toBeVisible({
    timeout: 5000,
  });
  await contexto.close();
});

test('HU-15 y HU-16: se arma con el buscador, nota y personas, y llega a cada estación', async ({
  page,
}) => {
  await entrarComo(page, 'garzon');
  await abrirMesa(page, 10);

  // CA1: sin tildes ni mayúsculas.
  await page.getByLabel('Buscar producto').fill('MARACUYA');
  await expect(page.getByRole('button', { name: /^Agregar / })).toHaveCount(1);
  await agregar(page, 'Jugo de maracuyá');
  await page.getByLabel('Buscar producto').fill('');
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await agregar(page, 'Papas fritas');

  // RN-12: con comida, el pedido no sale sin el número de personas.
  await enviar(page);
  const pedido = page.getByRole('dialog');
  await expect(pedido.getByText('¿Cuántas personas? La cocina lo necesita.')).toBeVisible();
  await pedido.getByRole('button', { name: 'Una persona más' }).click();
  await pedido.getByRole('button', { name: 'Una persona más' }).click();

  // CA2: cantidad y nota sin salir de la pantalla.
  await pedido.getByRole('button', { name: 'Sumar un Papas fritas' }).click();
  await pedido.getByRole('button', { name: 'Escribir nota para Jugo de maracuyá' }).click();
  await pedido.getByRole('textbox', { name: 'Nota para Jugo de maracuyá' }).fill('sin hielo');
  await pedido.getByRole('button', { name: /^Enviar pedido/ }).click();

  await expect(page.getByText(/^Pedido \d+ enviado a Barra Salón y Cocina$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver pedido (0)' })).toBeVisible();
});

test('el borrador sobrevive a una recarga del teléfono', async ({ page }) => {
  await entrarComo(page, 'garzon');
  await abrirMesa(page, 11);
  await agregar(page, 'Schop');
  await agregar(page, 'Schop');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ver pedido (2)' })).toBeVisible();
});

test('RN-13: si se pierde la respuesta, el reintento no duplica el pedido', async ({ page }) => {
  await entrarComo(page, 'garzon');
  await abrirMesa(page, 12);
  await agregar(page, 'Mojito');

  // El servidor recibe y guarda el pedido, pero la respuesta no llega al teléfono.
  let envios = 0;
  await page.route('**/api/pedidos', async (ruta) => {
    if (envios++ === 0) {
      await ruta.fetch();
      await ruta.abort('connectionreset');
    } else {
      await ruta.continue();
    }
  });
  await enviar(page);

  await expect(page.getByText(/reintenta y no se duplica/)).toBeVisible();
  // Mientras no se confirme, el pedido no se puede cambiar.
  await expect(page.getByRole('button', { name: 'Agregar Schop' })).toBeDisabled();

  await page.getByRole('button', { name: 'Reintentar envío' }).first().click();
  await expect(page.getByText(/^Pedido \d+ ya estaba enviado a Barra Salón$/)).toBeVisible();
  expect(envios).toBe(2);
});

test('HU-14 CA2: un cliente de pie se abre con una referencia y queda en las cuentas abiertas', async ({
  page,
}) => {
  await entrarComo(page, 'garzon');
  await expect(async () => {
    await page.getByRole('button', { name: 'Cliente de pie' }).click();
    await expect(page.getByLabel('Referencia para ubicarlo')).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByLabel('Referencia para ubicarlo').fill('gorro verde');
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'gorro verde' })).toBeVisible();

  await page.goto('/garzon/cuentas');
  await expect(page.getByRole('link', { name: /gorro verde/ })).toBeVisible();
});

test('una cuenta abierta por error se cierra sin consumo y libera la mesa', async ({ page }) => {
  page.on('dialog', (dialogo) => dialogo.accept());
  await entrarComo(page, 'garzon');
  await abrirMesa(page, 8);
  await page.getByRole('button', { name: 'Cerrar cuenta sin consumo' }).click();
  await expect(page).toHaveURL(/\/garzon$/);
  await expect(page.getByRole('button', { name: 'Mesa 8, libre' })).toBeVisible();
});
