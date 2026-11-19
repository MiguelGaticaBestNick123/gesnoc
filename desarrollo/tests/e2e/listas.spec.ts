import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

// Listas con vigencia (pedido del Product Owner, 18 nov): de una noche, de varias o sin término,
// como la de los clientes frecuentes, que la puerta reconoce mientras está vigente.

const hoy = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

const enDias = (dias: number) => {
  const fecha = new Date(`${hoy()}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

test('los clientes frecuentes son una lista sin término que se edita en «Listas»', async ({
  page,
}) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/listas');
  await expect(page.getByRole('heading', { name: 'Listas', exact: true })).toBeVisible();

  const frecuentes = page.getByRole('button', { name: /^Lista Clientes frecuentes/ });
  await expect(frecuentes).toContainText('Sin término, desde el');
  await expect(frecuentes).toContainText('Entran gratis');
  await frecuentes.click();
  await page.getByRole('button', { name: 'Agregar persona a Clientes frecuentes' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByRole('textbox', { name: 'Documento' }).fill('11.222.333-9');
  await dialogo.getByRole('textbox', { name: 'Nombre' }).fill('Isidora');
  await dialogo.getByRole('textbox', { name: 'Apellido' }).fill('Vega');
  await dialogo.getByRole('button', { name: 'Agregar' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByText('Isidora Vega', { exact: true })).toBeVisible();
  await expect(frecuentes).toContainText('4 personas · organiza Carla Muñoz');

  // La misma lista se ve en la página de la noche, entre las vigentes.
  await page.goto(`/admin/calendario/${hoy()}`);
  await expect(page.getByRole('button', { name: /^Lista Clientes frecuentes/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Lista Cumpleaños de Camila/ })).toContainText(
    'Solo esta noche',
  );
});

test('una lista de varias noches se programa con su primera y su última noche', async ({
  page,
}) => {
  await entrarComo(page, 'admin');
  await page.goto('/admin/listas');
  await page.getByRole('button', { name: 'Nueva lista' }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByRole('textbox', { name: 'Nombre de la lista' }).fill('Promotores de verano');
  await dialogo.getByRole('textbox', { name: 'Quién la organiza' }).fill('Javiera Soto');
  await dialogo
    .getByRole('radiogroup', { name: '¿Cuánto dura?' })
    .getByText('Varias', { exact: true })
    .click();
  await dialogo.getByRole('textbox', { name: 'Desde', exact: true }).fill(enDias(2));
  await dialogo.getByRole('textbox', { name: 'Hasta', exact: true }).fill(enDias(30));
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Próximas (1)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Lista Promotores de verano/ })).toContainText(
    /Del \d+ de \S+ al \d+ de \S+/,
  );
});
