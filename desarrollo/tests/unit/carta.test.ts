import { describe, expect, it } from 'vitest';
import {
  agruparPorCategoria,
  enlaceDeCarta,
  esCodigoDeMesa,
  ordenarProductos,
  origenDe,
} from '@/modules/local/carta';
import { llamaDesde } from '@/modules/venta/cola';

const productos = [
  { id: 1, nombre: 'Pisco sour', precio: 5500 },
  { id: 2, nombre: 'Mojito', precio: 6500 },
  { id: 3, nombre: 'Cerveza', precio: 3500 },
  { id: 4, nombre: 'Agua', precio: 3500 },
];
const nombres = (lista: { nombre: string }[]) => lista.map((p) => p.nombre);

describe('HU-38 CA2: ordenar la carta', () => {
  it('sin elegir, por nombre', () => {
    expect(nombres(ordenarProductos(productos, 'nombre'))).toEqual([
      'Agua',
      'Cerveza',
      'Mojito',
      'Pisco sour',
    ]);
  });

  it('por precio, de menor a mayor y al revés; con el mismo precio, por nombre', () => {
    expect(nombres(ordenarProductos(productos, 'menor'))).toEqual([
      'Agua',
      'Cerveza',
      'Pisco sour',
      'Mojito',
    ]);
    expect(nombres(ordenarProductos(productos, 'mayor'))).toEqual([
      'Mojito',
      'Pisco sour',
      'Agua',
      'Cerveza',
    ]);
  });

  it('no cambia la lista original', () => {
    ordenarProductos(productos, 'mayor');
    expect(productos[0]!.nombre).toBe('Pisco sour');
  });
});

describe('agrupar por categoría', () => {
  it('conserva el orden de llegada de las categorías y de sus productos', () => {
    const grupos = agruparPorCategoria([
      { categoriaId: 2, categoria: 'Tragos', id: 1, nombre: 'Mojito', precio: 6500 },
      { categoriaId: 1, categoria: 'Bebidas', id: 2, nombre: 'Agua', precio: 2000 },
      { categoriaId: 2, categoria: 'Tragos', id: 3, nombre: 'Piscola', precio: 5000 },
    ]);
    expect(grupos.map((g) => g.nombre)).toEqual(['Tragos', 'Bebidas']);
    expect(nombres(grupos[0]!.productos)).toEqual(['Mojito', 'Piscola']);
    expect(grupos[0]!.productos[0]).toEqual({ id: 1, nombre: 'Mojito', precio: 6500 });
  });
});

describe('código de la mesa', () => {
  it('acepta el formato de la base (base64url, de 22 a 64 caracteres)', () => {
    expect(esCodigoDeMesa('AbCdEfGhIjKlMnOpQrStU_')).toBe(true);
    expect(esCodigoDeMesa('a'.repeat(64))).toBe(true);
  });

  it('rechaza lo demás sin consultar la base', () => {
    expect(esCodigoDeMesa('corto')).toBe(false);
    expect(esCodigoDeMesa('a'.repeat(65))).toBe(false);
    expect(esCodigoDeMesa("abcdefghijklmnopqrstuv' or 1=1")).toBe(false);
    expect(esCodigoDeMesa('abcdefghijklmnopqrst/v')).toBe(false);
  });
});

describe('enlace del QR', () => {
  const cabeceras = (valores: Record<string, string>) => ({
    get: (nombre: string) => valores[nombre] ?? null,
  });

  it('detrás del proxy usa el dominio y el protocolo públicos', () => {
    const origen = origenDe(
      cabeceras({
        host: 'interno:8080',
        'x-forwarded-host': 'gesnoc.example',
        'x-forwarded-proto': 'https',
      }),
    );
    expect(origen).toBe('https://gesnoc.example');
    expect(enlaceDeCarta(origen, 'abc')).toBe('https://gesnoc.example/carta/abc');
  });

  it('en la red del local, sin proxy, es HTTP con la dirección usada', () => {
    expect(origenDe(cabeceras({ host: '192.168.1.20:3000' }))).toBe('http://192.168.1.20:3000');
  });

  it('con varios proxies toma el primero', () => {
    expect(
      origenDe(cabeceras({ 'x-forwarded-host': 'a.cl, b.cl', 'x-forwarded-proto': 'https, http' })),
    ).toBe('https://a.cl');
  });
});

describe('HU-40: cuánto lleva esperando un llamado', () => {
  it('en minutos', () => {
    expect(llamaDesde(20)).toBe('recién');
    expect(llamaDesde(150)).toBe('hace 2 min');
  });
});
