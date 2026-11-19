import { expect, test } from '@playwright/test';
import { entrarComo } from './apoyo';

// Chat del personal (pedido del Product Owner, 18 nov): el aviso de un garzón llega a la
// administración en segundos, con quién lo escribió y su puesto.

test('un aviso del garzón al canal general llega a la administración', async ({
  page,
  browser,
}) => {
  await entrarComo(page, 'garzon');
  await page.getByRole('button', { name: /^Chat del personal/ }).click();
  const panel = page.getByRole('dialog', { name: 'Chat del personal' });
  // El garzón tiene el canal general y el de su rol.
  await expect(panel.getByRole('radio', { name: 'General' })).toBeChecked();
  await expect(panel.getByText('Garzones', { exact: true })).toBeVisible();
  await panel.getByRole('textbox', { name: 'Mensaje para General' }).fill('Se acabó el limón');
  await panel.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(panel.getByText('Se acabó el limón')).toBeVisible();
  await expect(panel.getByRole('textbox', { name: 'Mensaje para General' })).toHaveValue('');

  const contexto = await browser.newContext();
  const admin = await contexto.newPage();
  await entrarComo(admin, 'admin');
  const boton = admin.getByRole('button', { name: /^Chat del personal: \d+ sin leer$/ });
  await expect(boton).toBeVisible({ timeout: 8000 });
  await boton.click();
  const panelAdmin = admin.getByRole('dialog', { name: 'Chat del personal' });
  // La administración elige entre todos los canales.
  await expect(panelAdmin.getByRole('combobox', { name: 'Canal' })).toBeVisible();
  await expect(panelAdmin.getByText('Se acabó el limón')).toBeVisible();
  await expect(panelAdmin.getByText('Diego Soto · Garzón')).toBeVisible();
  // Leído, el aviso de no leídos se apaga.
  await admin.keyboard.press('Escape');
  await expect(admin.getByRole('button', { name: 'Chat del personal', exact: true })).toBeVisible();
  await contexto.close();
});
