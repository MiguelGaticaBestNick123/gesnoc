import { describe, expect, it } from 'vitest';
import { categoria, describir } from '@/modules/noche/bitacora';

describe('bitácora: cada evento en una línea legible', () => {
  it('pedidos y anulaciones', () => {
    expect(
      describir({
        tipo: 'pedido',
        datos: { pedido: 7, cuenta: 3, items: '2 × Mojito, 1 × Papas fritas', total: 19500 },
      }),
    ).toBe('Envió el pedido 7 (cuenta 3): 2 × Mojito, 1 × Papas fritas · $19.500');
    expect(describir({ tipo: 'anulacion', datos: { pedido: 7, item: '1 × Papas fritas' } })).toBe(
      'Anuló 1 × Papas fritas del pedido 7',
    );
    expect(describir({ tipo: 'lista', datos: { pedido: 7, estacion: 'Barra Salón' } })).toBe(
      'Barra Salón marcó listo el pedido 7',
    );
  });

  it('cobros, con propina y medio; el cierre dice si quedó saldo', () => {
    expect(
      describir({
        tipo: 'pago',
        datos: { cuenta: 3, monto: 13000, propina: 1300, medio: 'tarjeta' },
      }),
    ).toBe('Cobró $13.000 + $1.300 de propina con tarjeta · cuenta 3');
    expect(describir({ tipo: 'cuenta_cerrada', datos: { cuenta: 3, saldo: 0 } })).toBe(
      'Se cerró la cuenta 3, pagada',
    );
    expect(describir({ tipo: 'cuenta_cerrada', datos: { cuenta: 4, saldo: 6500 } })).toBe(
      'Cerró la cuenta 4 con $6.500 sin cobrar',
    );
  });

  it('puerta: entradas con su forma, reportes y sorteo', () => {
    expect(
      describir({
        tipo: 'entrada',
        datos: { cliente: 'Iván Mora', ticket: 12, medio: 'efectivo' },
      }),
    ).toBe('Registró la entrada de Iván Mora (EF) · ticket 12');
    expect(
      describir({ tipo: 'entrada', datos: { cliente: 'Ana Soto', ticket: null, medio: null } }),
    ).toBe('Registró la entrada de Ana Soto (gratis)');
    expect(describir({ tipo: 'reporte', datos: { cliente: 'Iván Mora', tipo: 'expulsion' } })).toBe(
      'Reportó a Iván Mora con una expulsión',
    );
  });

  it('cada tipo tiene su categoría para filtrar', () => {
    expect(categoria('pago')).toBe('cobros');
    expect(categoria('llamado_atendido')).toBe('llamados');
    expect(categoria('sorteo')).toBe('puerta');
  });
});
