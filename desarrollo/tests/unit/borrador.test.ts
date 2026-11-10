import { describe, expect, it } from 'vitest';
import {
  agregar,
  BORRADOR_VACIO,
  cambiarCantidad,
  guardarBorrador,
  leerBorrador,
  llaveDeBorrador,
} from '@/modules/venta/borrador';
import { paraBuscar } from '@/shared/utilidades/buscar';
import { formatearHora } from '@/shared/utilidades/fechas';

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    get length() {
      return datos.size;
    },
    key: (indice: number) => [...datos.keys()][indice] ?? null,
    getItem: (llave: string) => datos.get(llave) ?? null,
    setItem: (llave: string, valor: string) => void datos.set(llave, valor),
    removeItem: (llave: string) => void datos.delete(llave),
  };
}

describe('borrador del pedido', () => {
  const llave = llaveDeBorrador('2026-11-07', 3);
  const borrador = { lineas: [{ productoId: 1, cantidad: 2, nota: 'sin hielo' }], personas: 0 };

  it('sobrevive a una recarga', () => {
    const almacen = almacenFalso();
    guardarBorrador(almacen, llave, borrador);
    expect(leerBorrador(almacen, llave, '2026-11-07')).toEqual(borrador);
  });

  it('conserva la clave de un envío sin confirmar', () => {
    const almacen = almacenFalso();
    guardarBorrador(almacen, llave, { ...borrador, clave: 'clave-1' });
    expect(leerBorrador(almacen, llave, '2026-11-07').clave).toBe('clave-1');
  });

  it('los borradores de otra noche se descartan al abrir la pantalla', () => {
    const viejo = llaveDeBorrador('2026-11-06', 3);
    const almacen = almacenFalso({ [viejo]: JSON.stringify(borrador), otra: 'x' });
    leerBorrador(almacen, llave, '2026-11-07');
    expect([...almacen.datos.keys()]).toEqual(['otra']);
  });

  it('un borrador dañado no rompe la pantalla', () => {
    const almacen = almacenFalso({ [llave]: '{"lineas":[{"productoId":"x"}]}' });
    expect(leerBorrador(almacen, llave, '2026-11-07')).toEqual(BORRADOR_VACIO);
  });

  it('vacío y sin envío pendiente no ocupa espacio', () => {
    const almacen = almacenFalso({ [llave]: JSON.stringify(borrador) });
    guardarBorrador(almacen, llave, BORRADOR_VACIO);
    expect(almacen.datos.size).toBe(0);
  });

  it('agregar suma en la misma línea y quitar hasta cero la elimina', () => {
    const una = agregar([], 7);
    expect(agregar(una, 7)).toEqual([{ productoId: 7, cantidad: 2, nota: '' }]);
    expect(cambiarCantidad(una, 7, -1)).toEqual([]);
  });
});

describe('buscador (HU-15 CA1)', () => {
  it.each([
    ['maracuya', 'Jugo de maracuyá'],
    ['PISCO', 'Pisco sour'],
    ['pina', 'Piña colada'],
  ])('«%s» encuentra «%s»', (escrito, producto) => {
    expect(paraBuscar(producto)).toContain(paraBuscar(escrito));
  });
});

describe('hora de la noche', () => {
  it('lee la marca de la base y la muestra en hora de Chile', () => {
    expect(formatearHora('2026-11-08 02:15:30.123+00')).toBe('23:15');
  });
});
