import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

// RNF-10: la aplicación se instala en la pantalla de inicio del teléfono. Chrome lo ofrece solo si el
// manifiesto trae nombre, inicio, modo «standalone» e íconos de 192 y 512 px que existan de verdad.
const enPublic = (ruta: string) => new URL(`../../public${ruta}`, import.meta.url);

/** Ancho y alto de un PNG, leídos de su cabecera (IHDR). */
function medidas(ruta: string) {
  const png = readFileSync(enPublic(ruta));
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe('aplicación instalable (RNF-10)', () => {
  const datos = manifest();

  it('se abre en su propia ventana, en español de Chile y desde la portada', () => {
    expect(datos).toMatchObject({
      name: 'GesNoc',
      short_name: 'GesNoc',
      lang: 'es-CL',
      start_url: '/',
      display: 'standalone',
    });
  });

  it('cada ícono existe en public/ con el tamaño que declara', () => {
    for (const icono of datos.icons ?? []) {
      expect(medidas(icono.src), icono.src).toBe(icono.sizes);
    }
    const tamanos = (datos.icons ?? []).map((icono) => icono.sizes);
    expect(tamanos).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(datos.icons?.some((icono) => icono.purpose === 'maskable')).toBe(true);
  });
});
