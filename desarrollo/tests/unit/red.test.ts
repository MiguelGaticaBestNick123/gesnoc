import { describe, expect, it } from 'vitest';
import { APP_ACTUALIZADA, CORTE_DE_RED, mensajeDeFalla, nuevaClaveDeEnvio } from '@/shared/red';

describe('mensajes de falla', () => {
  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'The network connection was lost.',
  ])('un corte de red se reconoce: %s', (texto) => {
    expect(mensajeDeFalla(new TypeError(texto))).toBe(CORTE_DE_RED);
  });

  it('una acción que ya no existe tras actualizar la aplicación pide recargar', () => {
    expect(mensajeDeFalla(new Error('Failed to find Server Action "abc"'))).toBe(APP_ACTUALIZADA);
  });

  it('un error interno no muestra detalles técnicos', () => {
    expect(mensajeDeFalla(new Error('duplicate key value violates unique constraint'))).not.toMatch(
      /duplicate/,
    );
  });
});

describe('clave de envío', () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('es un UUID v4, como exige la columna', () => {
    expect(nuevaClaveDeEnvio()).toMatch(uuid);
  });

  it('sin HTTPS, donde no existe randomUUID, sigue siendo un UUID v4 válido', () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
    try {
      const claves = new Set(Array.from({ length: 50 }, nuevaClaveDeEnvio));
      expect(claves.size).toBe(50);
      for (const clave of claves) expect(clave).toMatch(uuid);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: original,
        configurable: true,
      });
    }
  });
});
