import { expect, test } from '@playwright/test';
import { abrirMesa, agregar, entrarComo, enviar } from './apoyo';

// La mesa 6 del Salón es solo de esta prueba: las demás corren en paralelo sobre la misma noche, así
// que la barra y la cocina pueden tener otras comandas y se busca la de este pedido por su número.

test('HU-17 a HU-19: cada estación recibe su parte en 5 s o menos y la barra la marca lista', async ({
  page,
  browser,
}) => {
  const contextos = await Promise.all([browser.newContext(), browser.newContext()]);
  const [barra, cocina] = await Promise.all(contextos.map((c) => c.newPage()));
  await entrarComo(barra!, 'barra');
  await expect(barra!).toHaveURL(/\/barra$/);
  await entrarComo(cocina!, 'cocina');
  await expect(cocina!).toHaveURL(/\/cocina$/);

  await entrarComo(page, 'garzon');
  await abrirMesa(page, 6);
  await agregar(page, 'Mojito');
  await agregar(page, 'Papas fritas');
  await enviar(page);
  const hoja = page.getByRole('dialog');
  await hoja.getByRole('button', { name: 'Una persona más' }).click();
  await hoja.getByRole('button', { name: 'Una persona más' }).click();
  await hoja.getByRole('button', { name: /^Enviar pedido/ }).click();
  const enviado = page.getByText(/^Pedido \d+ enviado a Barra Salón y Cocina$/);
  await expect(enviado).toBeVisible();
  const numero = (await enviado.textContent())!.match(/\d+/)![0];

  // HU-17 CA1 y RNF-05: la barra ve el trago, con la mesa y el garzón, sin la comida.
  const enBarra = barra!.getByRole('article', { name: `Pedido ${numero}`, exact: true });
  await expect(enBarra).toBeVisible({ timeout: 5000 });
  await expect(enBarra.getByText('1 × Mojito')).toBeVisible();
  await expect(enBarra.getByText('Mesa 6 · Diego Soto')).toBeVisible();
  await expect(enBarra.getByText(/Papas fritas/)).toHaveCount(0);

  // HU-18: la cocina ve la comida con el número de personas, sin bebidas.
  const enCocina = cocina!.getByRole('article', { name: `Pedido ${numero}`, exact: true });
  await expect(enCocina).toBeVisible({ timeout: 5000 });
  await expect(enCocina.getByText('1 × Papas fritas')).toBeVisible();
  await expect(enCocina.getByText('Para 2 personas')).toBeVisible();
  await expect(enCocina.getByText(/Mojito/)).toHaveCount(0);

  // HU-19: marcada lista, pasa a «listas para retirar»; la cocina sigue con su parte.
  await barra!
    .getByRole('button', { name: `Marcar lista el pedido ${numero}`, exact: true })
    .click();
  await expect(
    barra!.getByRole('article', { name: `Pedido ${numero}, lista`, exact: true }),
  ).toBeVisible();
  await expect(enBarra).toHaveCount(0);
  await expect(enCocina).toBeVisible();

  await Promise.all(contextos.map((c) => c.close()));
});
