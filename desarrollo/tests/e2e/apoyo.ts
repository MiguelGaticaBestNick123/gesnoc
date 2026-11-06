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
