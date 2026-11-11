import { describe, expect, it } from 'vitest';
import {
  armarCola,
  nivelDeEspera,
  nuevos,
  type FilaComanda,
  type FilaLinea,
} from '@/modules/venta/cola';

const comanda = (pedido: number, cambios: Partial<FilaComanda> = {}): FilaComanda => ({
  pedido,
  personas: null,
  espera: 60,
  listaHace: null,
  mesa: 4,
  referencia: null,
  ambiente: 'Salón',
  garzon: 'Diego',
  ...cambios,
});

const linea = (pedido: number, numero: number, cambios: Partial<FilaLinea> = {}): FilaLinea => ({
  pedido,
  linea: numero,
  producto: 'Mojito',
  cantidad: 1,
  nota: null,
  anuladaHace: null,
  ...cambios,
});

describe('HU-17 CA2: tiempo de espera', () => {
  it.each([
    [0, 'normal'],
    [600, 'normal'],
    [601, 'atrasada'],
    [1200, 'atrasada'],
    [1201, 'critica'],
  ])('%i segundos es %s', (segundos, nivel) => {
    expect(nivelDeEspera(segundos)).toBe(nivel);
  });
});

describe('cola de una estación', () => {
  it('HU-17: en orden de llegada, primero lo más antiguo', () => {
    const cola = armarCola(
      [comanda(3, { espera: 30 }), comanda(1, { espera: 900 }), comanda(2, { espera: 300 })],
      [linea(1, 1), linea(2, 1), linea(3, 1)],
    );
    expect(cola.pendientes.map((c) => c.pedido)).toEqual([1, 2, 3]);
  });

  it('separa las listas para retirar, con la más reciente arriba', () => {
    const cola = armarCola(
      [comanda(1, { listaHace: 400 }), comanda(2), comanda(3, { listaHace: 20 })],
      [linea(1, 1), linea(2, 1), linea(3, 1)],
    );
    expect(cola.pendientes.map((c) => c.pedido)).toEqual([2]);
    expect(cola.listas.map((c) => c.pedido)).toEqual([3, 1]);
  });

  it('ubica la comanda por mesa o por la referencia del cliente de pie', () => {
    const cola = armarCola(
      [comanda(1), comanda(2, { mesa: null, referencia: 'polera roja' })],
      [linea(1, 1), linea(2, 1)],
    );
    expect(cola.pendientes.map((c) => c.ubicacion)).toEqual(['Mesa 4', 'polera roja']);
  });

  it('agrupa las líneas de cada comanda en su orden, con su nota', () => {
    const cola = armarCola(
      [comanda(1)],
      [linea(1, 2, { producto: 'Piscola' }), linea(1, 1, { nota: 'sin hielo' })],
    );
    expect(cola.pendientes[0]?.lineas).toEqual([
      { linea: 1, producto: 'Mojito', cantidad: 1, nota: 'sin hielo', anulada: false },
      { linea: 2, producto: 'Piscola', cantidad: 1, nota: null, anulada: false },
    ]);
  });

  it('HU-17 CA3: un ítem anulado se ve tachado y la comanda sigue', () => {
    const cola = armarCola([comanda(1)], [linea(1, 1, { anuladaHace: 30 }), linea(1, 2)]);
    expect(cola.pendientes[0]?.anulada).toBe(false);
    expect(cola.pendientes[0]?.lineas.map((l) => l.anulada)).toEqual([true, false]);
  });

  it('una comanda anulada completa se ve 5 minutos y después sale de la cola', () => {
    const anulada = (hace: number) =>
      armarCola(
        [comanda(1)],
        [linea(1, 1, { anuladaHace: hace }), linea(1, 2, { anuladaHace: 10 })],
      );
    expect(anulada(200).pendientes[0]?.anulada).toBe(true);
    expect(anulada(200).pendientes).toHaveLength(1);
    // Cuenta la anulación más reciente: la segunda línea se anuló hace 10 segundos.
    expect(anulada(900).pendientes).toHaveLength(1);
    expect(armarCola([comanda(1)], [linea(1, 1, { anuladaHace: 301 })]).pendientes).toHaveLength(0);
  });

  it('una comanda sin líneas todavía (llegó entre las dos consultas) espera a la siguiente', () => {
    expect(armarCola([comanda(1)], []).pendientes).toHaveLength(0);
  });
});

describe('aviso de comanda nueva', () => {
  it('solo cuenta los pedidos que no estaban', () => {
    expect(nuevos([1, 2], [1, 2, 3])).toEqual([3]);
    expect(nuevos([1, 2, 3], [2, 3])).toEqual([]);
  });
});
