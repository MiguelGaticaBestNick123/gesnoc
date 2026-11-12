import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './apoyo';

// Corre al final, cuando terminaron las demás pruebas (proyecto «cierre»): la administración recibe
// el efectivo, cierra las cuentas que quedaron, cuenta la caja con una diferencia y su nota, y
// cierra la noche (HU-26, HU-27, HU-28 y HU-12). Después, el turno ya no da acceso (RN-05).

const aceptarDialogos = (page: Page) => page.on('dialog', (dialogo) => dialogo.accept());

test('la noche se cierra con la caja explicada y el turno deja de dar acceso', async ({
  page,
  browser,
}) => {
  aceptarDialogos(page);
  await entrarComo(page, 'admin');

  await page.goto('/admin/noche');
  // Con la caja sin contar, el cierre no se ofrece (RN-20).
  await expect(page.getByRole('button', { name: 'Cerrar la noche' })).toBeDisabled();

  // HU-26: el efectivo de cada garzón, uno por uno.
  await page.goto('/admin/efectivo');
  const confirmar = page.getByRole('button', { name: /^Recibí \$/ });
  for (let vuelta = 0; vuelta < 10 && (await confirmar.count()) > 0; vuelta++) {
    const antes = await confirmar.count();
    await confirmar.first().click();
    await expect(confirmar).toHaveCount(antes - 1);
  }
  await expect(page.getByText('No queda efectivo por confirmar.')).toBeVisible();

  // HU-27: las cuentas que quedaron abiertas en las otras pruebas.
  await page.goto('/admin/saldos');
  const cerrar = page.getByRole('button', { name: /^Cerrar (con saldo|cuenta)/ });
  for (let vuelta = 0; vuelta < 30 && (await cerrar.count()) > 0; vuelta++) {
    const antes = await cerrar.count();
    await cerrar.first().click();
    await expect(cerrar).toHaveCount(antes - 1);
  }
  await expect(page.getByText('No quedan cuentas abiertas.')).toBeVisible();

  // HU-28: se cuentan $1.000 menos y la diferencia se explica.
  await page.goto('/admin/arqueo');
  const esperado = await page.getByLabel(/^Esperado: /).getAttribute('aria-label');
  const monto = Number(esperado!.replace(/\D/g, ''));
  await page.getByLabel('Efectivo contado').fill(String(monto - 1000));
  await expect(page.getByText('faltan $1.000')).toBeVisible();
  await page.getByLabel('Nota').fill('Un vuelto mal dado en la barra');
  await page.getByRole('button', { name: 'Guardar conteo' }).click();
  await expect(page.getByText(/Último conteo/)).toBeVisible();

  // HU-12: sin pendientes, la noche se cierra.
  await page.goto('/admin/noche');
  await page.getByRole('button', { name: 'Cerrar la noche' }).click();
  await expect(page.getByRole('button', { name: 'Abrir noche' })).toBeVisible();

  // Sin noche abierta, el garzón vuelve a ver solo su calendario.
  const contexto = await browser.newContext();
  const telefono = await contexto.newPage();
  await entrarComo(telefono, 'garzon');
  await expect(telefono).toHaveURL(/\/personal$/);
  await contexto.close();
});
