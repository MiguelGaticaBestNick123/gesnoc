import { describe, expect, it } from 'vitest';
import {
  agruparPedidos,
  estadoDe,
  ordenarMisComandas,
  resumenCuenta,
  type FilaDetalle,
  type FilaMiComanda,
} from '@/modules/venta/cuenta';

const fila = (pedido: number, linea: number, cambios: Partial<FilaDetalle> = {}): FilaDetalle => ({
  pedido,
  enviadoEn: '2026-11-07 23:10:00-03',
  tomadoPor: 'Diego',
  linea,
  producto: 'Mojito',
  cantidad: 1,
  precioUnitario: 6500,
  nota: null,
  estacion: 'Barra Salón',
  lista: false,
  entregada: false,
  anuladoEn: null,
  anuladoPor: null,
  ...cambios,
});

describe('HU-23: total, pagado y saldo', () => {
  it('CA2: los ítems anulados no suman al total', () => {
    const lineas = [
      fila(1, 1, { cantidad: 2 }),
      fila(1, 2, { anuladoEn: '2026-11-07 23:15:00-03', anuladoPor: 'Diego' }),
    ];
    expect(resumenCuenta(lineas, [])).toEqual({ total: 13000, pagado: 0, saldo: 13000 });
  });

  it('el saldo descuenta solo el monto de cada pago; la propina va aparte', () => {
    const lineas = [fila(1, 1, { cantidad: 3 })];
    expect(resumenCuenta(lineas, [{ monto: 6500 }, { monto: 6500 }])).toEqual({
      total: 19500,
      pagado: 13000,
      saldo: 6500,
    });
  });

  it('una cuenta sin pedidos tiene saldo cero', () => {
    expect(resumenCuenta([], [])).toEqual({ total: 0, pagado: 0, saldo: 0 });
  });
});

describe('HU-23 CA1: detalle por pedido', () => {
  it('agrupa las líneas por pedido en el orden de envío, con su estado', () => {
    const pedidos = agruparPedidos([
      fila(2, 1, { producto: 'Papas fritas', estacion: 'Cocina' }),
      fila(1, 2, { producto: 'Piscola', lista: true }),
      fila(1, 1, { lista: true, entregada: true }),
    ]);
    expect(pedidos.map((p) => p.numero)).toEqual([1, 2]);
    expect(pedidos[0]?.lineas.map((l) => [l.producto, l.estado])).toEqual([
      ['Mojito', 'entregada'],
      ['Piscola', 'lista'],
    ]);
    expect(pedidos[1]?.lineas[0]?.estado).toBe('en preparación');
  });

  it('una línea anulada dice quién y cuándo (HU-22 CA2)', () => {
    const [pedido] = agruparPedidos([
      fila(1, 1, { anuladoEn: '2026-11-07 23:15:00-03', anuladoPor: 'Paula' }),
    ]);
    expect(pedido?.lineas[0]?.anulada).toEqual({ en: '2026-11-07 23:15:00-03', por: 'Paula' });
  });

  it.each([
    [false, false, 'en preparación'],
    [true, false, 'lista'],
    [true, true, 'entregada'],
  ] as const)('lista=%s y entregada=%s es %s', (lista, entregada, estado) => {
    expect(estadoDe(lista, entregada)).toBe(estado);
  });
});

describe('HU-20: las comandas del garzón', () => {
  const comanda = (pedido: number, cambios: Partial<FilaMiComanda> = {}): FilaMiComanda => ({
    pedido,
    estacionId: 1,
    estacion: 'Barra Salón',
    cuenta: 1,
    mesa: 4,
    referencia: null,
    resumen: '1 × Mojito',
    espera: 60,
    listaHace: null,
    ...cambios,
  });

  it('arriba la lista que lleva más tiempo esperando, y aparte las que se preparan', () => {
    const { listas, enPreparacion } = ordenarMisComandas([
      comanda(1, { listaHace: 30 }),
      comanda(2, { listaHace: 300 }),
      comanda(3, { espera: 100 }),
      comanda(4, { espera: 700 }),
    ]);
    expect(listas.map((c) => c.pedido)).toEqual([2, 1]);
    expect(enPreparacion.map((c) => c.pedido)).toEqual([4, 3]);
  });

  it('CA2: dice el número de pedido y la mesa o la referencia', () => {
    const { listas } = ordenarMisComandas([
      comanda(1, { listaHace: 10 }),
      comanda(2, { listaHace: 5, mesa: null, referencia: 'polera roja' }),
    ]);
    expect(listas.map((c) => [c.pedido, c.ubicacion])).toEqual([
      [1, 'Mesa 4'],
      [2, 'polera roja'],
    ]);
  });
});
