import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

// Corre sola, después de las pruebas del proyecto «movil» y antes del cierre: el llamado de una mesa
// aparece en todas las pantallas de los garzones del ambiente, y en paralelo taparía los botones que
// tocan las otras pruebas.

test('HU-07, HU-38, HU-39 y HU-40: el cliente llama desde la carta y el garzón lo atiende', async ({
  page,
  browser,
}) => {
  // HU-07: la administración ve el código QR de cada mesa con el enlace a su carta.
  await entrarComo(page, 'admin');
  await page.goto('/admin/qr');
  await expect(page.getByRole('heading', { name: 'Códigos QR' })).toBeVisible();
  // Otras pruebas crean ambientes: se elige el Salón, cuyo garzón recibirá el llamado.
  await page
    .getByRole('navigation', { name: 'Ambientes' })
    .getByRole('link', { name: 'Salón' })
    .click();
  await expect(page).toHaveURL(/\/admin\/qr\?ambiente=\d+$/);
  const enlace = await page
    .getByRole('link', { name: 'Abrir la carta de la mesa 5' })
    .getAttribute('href');
  expect(enlace).toMatch(/\/carta\/[\w-]{22}$/);
  const carta = new URL(enlace!).pathname;

  // El garzón del Salón trabaja en otra pantalla, la de sus cuentas.
  const contextoGarzon = await browser.newContext();
  const garzon = await contextoGarzon.newPage();
  await entrarComo(garzon, 'garzon');
  await garzon.goto('/garzon/cuentas');

  // HU-38: el cliente abre la carta sin sesión, con los productos por categoría y ordenables.
  const contextoCliente = await browser.newContext();
  const cliente = await contextoCliente.newPage();
  await cliente.goto(carta);
  await expect(cliente.getByRole('heading', { name: 'Carta' })).toBeVisible();
  await expect(cliente.getByText('Mesa 5 · Salón')).toBeVisible();
  await cliente.getByRole('button', { name: 'Tragos' }).click();
  await expect(cliente.getByRole('heading', { name: 'Tragos' })).toBeVisible();
  await expect(cliente.getByRole('heading', { name: 'Cervezas' })).toBeHidden();
  await cliente.getByText('Mayor precio').click();

  // HU-39 CA1: el llamado queda pendiente y la carta lo confirma.
  await cliente.getByRole('button', { name: 'Llamar al garzón' }).click();
  await expect(cliente.getByRole('status')).toHaveText('Avisamos al garzón: ya viene a tu mesa.');
  // CA2: otro toque confirma lo mismo, sin un error.
  await cliente.getByRole('button', { name: 'Volver a llamar' }).click();
  await expect(cliente.getByRole('status')).toHaveText('Avisamos al garzón: ya viene a tu mesa.');

  // HU-40 CA1: el aviso le llega al garzón del ambiente en su pantalla actual, en 5 s o menos.
  const aviso = garzon.getByRole('region', { name: 'Llamado de una mesa' });
  await expect(aviso.getByText('Mesa 5 te llama')).toBeVisible({ timeout: 5000 });
  // CA2: al marcarlo atendido deja de mostrarse.
  await aviso.getByRole('button', { name: 'Marcar atendido el llamado de la mesa 5' }).click();
  await expect(aviso).toBeHidden();
  await garzon.goto('/garzon/llamados');
  await expect(garzon.getByText('Ninguna mesa está llamando.')).toBeVisible();

  // HU-07 CA2 (RN-28): al regenerar el código, el enlace anterior ya no abre la carta.
  page.on('dialog', (dialogo) => dialogo.accept());
  const tarjeta = page.getByRole('article', { name: 'Mesa 5', exact: true });
  await tarjeta.getByRole('button', { name: 'Regenerar' }).click();
  await expect(page.getByRole('link', { name: 'Abrir la carta de la mesa 5' })).not.toHaveAttribute(
    'href',
    enlace!,
  );
  await cliente.goto(carta);
  await expect(
    cliente.getByRole('heading', { name: 'Este código no abre la carta' }),
  ).toBeVisible();

  await contextoGarzon.close();
  await contextoCliente.close();
});
