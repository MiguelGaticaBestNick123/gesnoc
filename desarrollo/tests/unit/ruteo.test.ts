import { describe, expect, it } from 'vitest';
import { datosAbrirCuenta, datosPedido } from '@/modules/venta/esquemas';
import { estacionDestino } from '@/modules/venta/ruteo';

const BARRA = 10;
const COCINA = 20;

describe('RN-10: estación de destino', () => {
  it('la estación del producto manda', () => {
    const producto = { estacionId: COCINA, reglaRuteo: 'barra_ambiente', estacionCategoria: null };
    expect(estacionDestino(producto, BARRA)).toBe(COCINA);
  });

  it('sin estación propia, va a la estación fija de su categoría', () => {
    const producto = { estacionId: null, reglaRuteo: 'fija', estacionCategoria: COCINA };
    expect(estacionDestino(producto, BARRA)).toBe(COCINA);
  });

  it('con la regla «barra del ambiente», va a la barra de la cuenta', () => {
    const producto = { estacionId: null, reglaRuteo: 'barra_ambiente', estacionCategoria: null };
    expect(estacionDestino(producto, BARRA)).toBe(BARRA);
  });

  it('si ese ambiente no tiene barra, no hay destino', () => {
    const producto = { estacionId: null, reglaRuteo: 'barra_ambiente', estacionCategoria: null };
    expect(estacionDestino(producto, null)).toBeNull();
  });
});

describe('datos de una cuenta', () => {
  it('una cuenta sin mesa exige ambiente y referencia (RN-07)', () => {
    expect(datosAbrirCuenta.safeParse({ ambienteId: 1 }).success).toBe(false);
    expect(datosAbrirCuenta.safeParse({ ambienteId: 1, referencia: '   ' }).success).toBe(false);
    expect(datosAbrirCuenta.parse({ ambienteId: 1, referencia: ' polera roja ' })).toEqual({
      ambienteId: 1,
      referencia: 'polera roja',
    });
  });

  it('con mesa basta la mesa', () => {
    expect(datosAbrirCuenta.parse({ mesaId: 4 })).toEqual({ mesaId: 4 });
  });
});

describe('datos de un pedido', () => {
  const base = {
    cuenta: 1,
    claveEnvio: '7b1e2c4a-1f3d-4a5b-9c6d-1e2f3a4b5c6d',
    personas: null,
    lineas: [{ productoId: 1, cantidad: 2, nota: ' sin hielo ' }],
  };

  it('acepta un pedido válido y limpia la nota', () => {
    expect(datosPedido.parse(base).lineas[0]?.nota).toBe('sin hielo');
  });

  it('una nota vacía no se guarda', () => {
    const datos = { ...base, lineas: [{ productoId: 1, cantidad: 1, nota: '  ' }] };
    expect(datosPedido.parse(datos).lineas[0]?.nota).toBeNull();
  });

  it.each([
    ['vacío', { lineas: [] }],
    ['cantidad 0', { lineas: [{ productoId: 1, cantidad: 0, nota: '' }] }],
    ['cantidad 100', { lineas: [{ productoId: 1, cantidad: 100, nota: '' }] }],
    ['nota larga', { lineas: [{ productoId: 1, cantidad: 1, nota: 'x'.repeat(141) }] }],
    ['clave que no es UUID', { claveEnvio: 'abc' }],
    ['51 personas', { personas: 51 }],
  ])('rechaza un pedido con %s', (_, cambio) => {
    expect(datosPedido.safeParse({ ...base, ...cambio }).success).toBe(false);
  });
});
