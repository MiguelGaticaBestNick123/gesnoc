import { expect, test, type Page } from '@playwright/test';
import { entrarComo } from './apoyo';

// La puerta como la pidió el Product Owner (12 nov): EF, RC, PN o gratis; el ticket solo para las
// pagadas; quien viene en una lista no se escribe y el guardia no ve lo recaudado.

const documento = (page: Page) => page.getByRole('textbox', { name: 'Documento' });

async function buscar(page: Page, rut: string) {
  await documento(page).fill(rut);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test.describe.configure({ mode: 'serial' });

test('HU-30 y HU-33: la lista trae el nombre, la entrada pagada recibe ticket y la gratis no', async ({
  page,
}) => {
  await entrarComo(page, 'guardia');
  await expect(page.getByRole('heading', { name: 'Entrada', exact: true })).toBeVisible();

  await buscar(page, '15.678.234-3');
  await expect(page.getByText('Paga su entrada')).toBeVisible();
  await expect(
    page.getByText('Viene en la lista «Cumpleaños de Camila», de Camila Rojas.'),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Camila');
  await page.getByRole('button', { name: 'EF, efectivo, $5.000' }).click();
  await expect(page.getByLabel('Ticket 1', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente persona' }).click();
  await buscar(page, '19876543-0');
  await expect(page.getByText('Entra gratis')).toBeVisible();
  await page.getByRole('button', { name: 'Gratis, sin ticket' }).click();
  await expect(page.getByText('Entrada gratis')).toBeVisible();

  // Una persona nueva: se escribe su nombre y queda pendiente (PN), con ticket.
  await page.getByRole('button', { name: 'Siguiente persona' }).click();
  await buscar(page, '13579246-2');
  await expect(page.getByText('Persona nueva')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nombre' }).fill('Tomás');
  await page.getByRole('textbox', { name: 'Apellido' }).fill('Ruiz');
  await page.getByRole('button', { name: 'PN, pendiente, $5.000' }).click();
  await expect(page.getByLabel('Ticket 2', { exact: true })).toBeVisible();

  const ingresos = page.getByRole('list', { name: 'Ingresos de esta noche' });
  await expect(ingresos.getByRole('listitem')).toHaveCount(3);
  await expect(ingresos.getByRole('listitem', { name: 'Tomás Ruiz, PN, ticket 2' })).toBeVisible();
  // El guardia no ve lo recaudado.
  await expect(page.getByText(/recaudado/i)).toHaveCount(0);
});

test('HU-30 CA2 (RN-21): quien ya entró no entra de nuevo y se ve con qué ticket', async ({
  page,
}) => {
  await entrarComo(page, 'guardia');
  await buscar(page, '156782343');
  await expect(page.getByText('Ya entró esta noche')).toBeVisible();
  await expect(page.getByText(/con el ticket 1 \(EF\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^EF,/ })).toHaveCount(0);
});

test('un RUT mal escrito no se busca', async ({ page }) => {
  await entrarComo(page, 'guardia');
  await buscar(page, '15.678.234-9');
  await expect(page.getByText(/RUT no válido/)).toBeVisible();
});

test('HU-32: el estado de la puerta lista quién entró, sin lo recaudado', async ({ page }) => {
  await entrarComo(page, 'guardia');
  await page.goto('/guardia/puerta');
  await expect(page.getByRole('heading', { name: 'Estado de la puerta' })).toBeVisible();
  await expect(page.getByText('3 personas')).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar entre los ingresos' }).fill('Javiera');
  const ingresos = page.getByRole('list', { name: 'Ingresos de esta noche' });
  await expect(ingresos.getByRole('listitem')).toHaveCount(1);
  await expect(ingresos.getByRole('listitem', { name: 'Javiera Soto, Gratis' })).toBeVisible();
});

test('HU-37: el guardia sortea el premio del Salón entre los tickets de la noche', async ({
  page,
}) => {
  await entrarComo(page, 'guardia');
  await page.goto('/guardia/sorteo');
  await expect(page.getByText('Participan 2 tickets')).toBeVisible();
  await expect(page.getByText('1 × Botella de ron añejo')).toBeVisible();
  await page.getByRole('button', { name: 'Sortear el premio de Salón' }).click();
  await expect(page.getByLabel(/^Ticket ganador [12]$/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Compara el nombre con la cédula')).toBeVisible();
  // Ya sorteado: el Salón no ofrece otro sorteo.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sortear el premio de Salón' })).toHaveCount(0);
});
