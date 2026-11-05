import { describe, expect, it } from 'vitest';
import { colaDe } from '@/modules/venta/demostracion';

describe('cola de una estación', () => {
  it('muestra solo los ítems de esa estación', () => {
    const cola = colaDe('Cocina');
    expect(cola.flatMap((c) => c.lineas).every((l) => l.estacion === 'Cocina')).toBe(true);
  });

  it('no incluye comandas ya entregadas', () => {
    expect(colaDe('Barra Salón').map((c) => c.pedido)).not.toContain(57);
  });

  it('ubica la comanda por mesa o por la referencia del cliente de pie', () => {
    expect(colaDe('Cocina').find((c) => c.pedido === 57)?.ubicacion).toBe('Mesa 4');
    expect(colaDe('Barra Terraza')[0]?.ubicacion).toBe('Polera roja, junto a la barra');
  });
});
