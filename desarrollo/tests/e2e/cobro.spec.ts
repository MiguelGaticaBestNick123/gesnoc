import { expect, test, type Page } from '@playwright/test';
import { abrirMesa, agregar, entrarComo, enviar } from './apoyo';

// Usan las mesas 5 y 7 del Salón, que ninguna otra prueba ocupa.

async function pedirYCobrar(page: Page, mesa: number, productos: string[]) {
  await entrarComo(page, 'garzon');
  await abrirMesa(page, mesa);
  for (const producto of productos) await agregar(page, producto);
  await enviar(page);
  await expect(page.getByText(/^Pedido \d+ enviado a Barra Salón$/)).toBeVisible();
  await page.getByRole('link', { name: 'Cobrar', exact: true }).click();
  await expect(page).toHaveURL(/\/cobrar$/);
}

const elegir = (page: Page, grupo: string, opcion: string) =>
  page.getByRole('radiogroup', { name: grupo }).getByText(opcion, { exact: true }).click();

test('HU-24 y HU-25: la cuenta se paga en dos partes, cada una con su medio y su propina', async ({
  page,
}) => {
  await pedirYCobrar(page, 7, ['Piscola', 'Piscola', 'Schop']);
  await expect(page.getByLabel('Saldo por cobrar: $15.500')).toBeVisible();

  // CA1 (RN-18): un monto mayor que el saldo no se puede cobrar.
  await elegir(page, 'Cuánto paga', 'Otro');
  await page.getByLabel('Monto que paga').fill('99000');
  await page.getByRole('button', { name: 'Tarjeta' }).click();
  await expect(page.getByText('El monto supera el saldo de $15.500.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Cobrar \$/ })).toBeDisabled();

  // HU-25: dividida en dos, con 10 % de propina y tarjeta.
  await elegir(page, 'Cuánto paga', '÷2');
  await expect(page.getByText(/^Parte 1 de 2/)).toBeVisible();
  await elegir(page, 'Propina', '10 %');
  await expect(page.getByText('10 % de $7.750: $780')).toBeVisible();
  await expect(page.getByLabel('A recibir: $8.530')).toBeVisible();
  await page.getByRole('button', { name: 'Cobrar $8.530' }).click();
  await expect(
    page.getByText('Pago 1 registrado: $7.750 + $780 de propina con tarjeta.'),
  ).toBeVisible();

  // La segunda parte es el saldo exacto, ahora en efectivo y sin propina.
  await expect(page.getByLabel('Saldo por cobrar: $7.750')).toBeVisible();
  await expect(page.getByText(/^Parte 2 de 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Efectivo' }).click();
  await page.getByRole('button', { name: 'Cobrar $7.750' }).click();

  // CA3: la cuenta se cierra, la mesa queda libre y el efectivo queda por entregar (CU-18 paso 6).
  await expect(page.getByRole('heading', { name: 'Cuenta pagada' })).toBeVisible();
  await expect(page.getByText('La mesa 7 quedó libre.')).toBeVisible();
  await expect(page.getByText('Entrega $7.750 en efectivo a la administración.')).toBeVisible();

  await page.getByRole('link', { name: 'Mi efectivo' }).click();
  await expect(page.getByRole('heading', { name: 'Efectivo por entregar' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Mesa 7.*\$7\.750/ })).toBeVisible();

  await page.goto('/garzon');
  await expect(page.getByRole('button', { name: 'Mesa 7, libre' })).toBeVisible();
});

test('RN-13: si se pierde la respuesta del cobro, el reintento no cobra dos veces', async ({
  page,
}) => {
  await pedirYCobrar(page, 5, ['Mojito']);

  // El servidor registra el pago, pero la respuesta no llega al teléfono.
  let envios = 0;
  await page.route('**/api/pagos', async (ruta) => {
    if (envios++ === 0) {
      await ruta.fetch();
      await ruta.abort('connectionreset');
    } else {
      await ruta.continue();
    }
  });
  await page.getByRole('button', { name: 'Tarjeta' }).click();
  await page.getByRole('button', { name: 'Cobrar $6.500' }).click();
  await expect(page.getByText(/reintenta y no se cobra dos veces/)).toBeVisible();

  // El cobro pendiente sobrevive a una recarga, con la misma clave de envío.
  await page.reload();
  await expect(page.getByText('Cobro sin confirmar')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar cobro' }).click();
  await expect(page.getByRole('heading', { name: 'Cuenta pagada' })).toBeVisible();
  expect(envios).toBe(2);

  await page.getByRole('link', { name: 'Cuenta', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Pagado: $6.500' })).toBeVisible();
});
