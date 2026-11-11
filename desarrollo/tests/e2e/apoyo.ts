import { expect, type Page } from '@playwright/test';
import { correoDe } from '../../db/seeds/demostracion';
import { CLAVE_PRUEBAS } from '../base-pruebas';

export async function ingresar(page: Page, correo: string, clave = CLAVE_PRUEBAS) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** Entra con una cuenta del local de demostración y espera salir de la pantalla de ingreso. */
export async function entrarComo(page: Page, persona: string) {
  await ingresar(page, correoDe(persona));
  await expect(page).not.toHaveURL(/\/ingresar/);
}

/** Abre una cuenta en una mesa libre del ambiente del garzón y entra a tomar el pedido. */
export async function abrirMesa(page: Page, numero: number) {
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

export const agregar = (page: Page, producto: string) =>
  page.getByRole('button', { name: `Agregar ${producto}` }).click();

export const enviar = (page: Page) => page.getByRole('button', { name: /^Enviar ·/ }).click();
