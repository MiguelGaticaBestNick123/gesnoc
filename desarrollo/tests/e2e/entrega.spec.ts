import { expect, test, type Browser } from '@playwright/test';
import { abrirMesa, agregar, entrarComo, enviar } from './apoyo';

// Estas pruebas usan al garzón y al barman de la Terraza, que ninguna otra prueba ocupa: así el aviso
// de una comanda lista de otra prueba no aparece en estas pantallas.

async function barmanDeTerraza(browser: Browser) {
  const contexto = await browser.newContext();
  const barra = await contexto.newPage();
  await entrarComo(barra, 'barra2');
  await expect(barra.getByRole('heading', { name: 'Barra Terraza' })).toBeVisible();
  return { contexto, barra };
}

test('HU-22 y HU-23: el detalle suma lo vigente y un ítem anulado se ve tachado en la barra', async ({
  page,
  browser,
}) => {
  const { contexto, barra } = await barmanDeTerraza(browser);
  await entrarComo(page, 'garzon2');
  await abrirMesa(page, 2);
  await agregar(page, 'Piscola');
  await agregar(page, 'Bebida');
  await enviar(page);
  const enviado = page.getByText(/^Pedido \d+ enviado a Barra Terraza$/);
  await expect(enviado).toBeVisible();
  const numero = (await enviado.textContent())!.match(/\d+/)![0];

  // HU-23 CA1: el detalle con el total, lo pagado y el saldo.
  await page.getByRole('link', { name: 'Cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/detalle$/);
  await expect(page.getByRole('group', { name: 'Total: $8.500' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Saldo: $8.500' })).toBeVisible();

  // HU-22: anular pide confirmación, deja autor y hora, y el anulado no suma (HU-23 CA2).
  await page.getByRole('button', { name: `Anular 1 × Bebida del pedido ${numero}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Anular' }).click();
  await expect(page.getByRole('group', { name: 'Total: $6.000' })).toBeVisible();
  await expect(page.getByText(/^Anulado por Paula Vera a las \d\d:\d\d$/)).toBeVisible();

  // CA2: la barra lo ve tachado y sigue preparando el resto.
  const comanda = barra.getByRole('article', { name: `Pedido ${numero}`, exact: true });
  await expect(comanda.getByText('1 × Bebida (anulado)')).toBeVisible({ timeout: 5000 });
  await expect(comanda.getByText('1 × Piscola', { exact: true })).toBeVisible();
  await contexto.close();
});

test('HU-20 y HU-21: el garzón ve sus comandas listas y las marca entregadas', async ({
  page,
  browser,
}) => {
  const { contexto, barra } = await barmanDeTerraza(browser);
  await entrarComo(page, 'garzon2');
  await abrirMesa(page, 3);
  await agregar(page, 'Cerveza en botella');
  await enviar(page);
  const enviado = page.getByText(/^Pedido \d+ enviado a Barra Terraza$/);
  await expect(enviado).toBeVisible();
  const numero = (await enviado.textContent())!.match(/\d+/)![0];

  await page.goto('/garzon/comandas');
  await expect(page.getByText(`Pedido ${numero} · Mesa 3 · Barra Terraza`)).toBeVisible();

  await barra
    .getByRole('button', { name: `Marcar lista el pedido ${numero}`, exact: true })
    .click();

  const lista = page.getByRole('article', { name: `Pedido ${numero}, Barra Terraza` });
  await expect(lista).toBeVisible({ timeout: 5000 });
  await expect(lista.getByText('Barra Terraza: 1 × Cerveza en botella')).toBeVisible();
  await lista.getByRole('button', { name: /^Marcar entregado/ }).click();
  await expect(lista).toHaveCount(0);
  await expect(page.getByText('Nada por retirar.')).toBeVisible();
  await contexto.close();
});
