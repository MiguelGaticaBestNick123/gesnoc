import { describe, expect, it } from 'vitest';
import {
  armarHistorial,
  estadoDe,
  filtrarHistorial,
  type FilaHistorial,
  type FilaLineaHistorial,
} from '@/modules/venta/historial';

// Historial de comandas de la noche (pedido del Product Owner, 18 nov).

const comanda = (
  pedido: number,
  estacionId: number,
  cambios: Partial<FilaHistorial> = {},
): FilaHistorial => ({
  pedido,
  estacionId,
  estacion: estacionId === 1 ? 'Barra Salón' : 'Cocina',
  hora: '23:41',
  lista: null,
  entregada: null,
  personas: null,
  mesa: 4,
  referencia: null,
  ambiente: 'Salón',
  garzon: 'Cote',
  ...cambios,
});

const linea = (
  pedido: number,
  estacionId: number,
  numero: number,
  producto: string,
  anulada = false,
): FilaLineaHistorial => ({
  pedido,
  estacionId,
  linea: numero,
  producto,
  cantidad: 1,
  nota: null,
  anulada,
});

describe('historial de comandas', () => {
  it('el estado sale de las marcas de tiempo; anulada si se anuló todo', () => {
    expect(estadoDe({ lista: null, entregada: null }, [{ anulada: false }])).toBe('pendiente');
    expect(estadoDe({ lista: '23:50', entregada: null }, [{ anulada: false }])).toBe('lista');
    expect(estadoDe({ lista: '23:50', entregada: '23:52' }, [{ anulada: false }])).toBe(
      'entregada',
    );
    expect(estadoDe({ lista: null, entregada: null }, [{ anulada: true }, { anulada: true }])).toBe(
      'anulada',
    );
  });

  it('agrupa las comandas de cada pedido, del más reciente al más antiguo', () => {
    const pedidos = armarHistorial(
      [
        comanda(1, 1, { lista: '23:45', entregada: '23:47' }),
        comanda(2, 2, { personas: 3, mesa: null, referencia: 'Gorro negro', hora: '23:50' }),
        comanda(2, 1, { hora: '23:50' }),
      ],
      [
        linea(1, 1, 1, 'Mojito'),
        linea(2, 2, 2, 'Tabla mixta'),
        linea(2, 1, 1, 'Schop'),
        linea(2, 1, 3, 'Piscola', true),
      ],
    );
    expect(pedidos.map((p) => [p.pedido, p.hora, p.ubicacion, p.personas])).toEqual([
      [2, '23:50', 'Gorro negro', 3],
      [1, '23:41', 'Mesa 4', null],
    ]);
    // Las estaciones en orden alfabético, cada una con sus líneas en el orden del pedido.
    expect(
      pedidos[0]!.comandas.map((c) => [c.estacion, c.estado, c.lineas.map((l) => l.producto)]),
    ).toEqual([
      ['Barra Salón', 'pendiente', ['Schop', 'Piscola']],
      ['Cocina', 'pendiente', ['Tabla mixta']],
    ]);
    expect(pedidos[1]!.comandas[0]).toMatchObject({ estado: 'entregada', entregada: '23:47' });
  });

  it('filtra por estación y busca por mesa, garzón o producto sin tildes', () => {
    const pedidos = armarHistorial(
      [comanda(1, 1), comanda(2, 2, { garzon: 'Matías', mesa: 7 })],
      [linea(1, 1, 1, 'Jugo de maracuyá'), linea(2, 2, 1, 'Papas fritas')],
    );
    expect(filtrarHistorial(pedidos, 2, '').map((p) => p.pedido)).toEqual([2]);
    expect(filtrarHistorial(pedidos, null, 'MATIAS').map((p) => p.pedido)).toEqual([2]);
    expect(filtrarHistorial(pedidos, null, 'maracuya').map((p) => p.pedido)).toEqual([1]);
    expect(filtrarHistorial(pedidos, null, 'mesa 7').map((p) => p.pedido)).toEqual([2]);
    expect(filtrarHistorial(pedidos, 1, 'papas')).toEqual([]);
  });
});
