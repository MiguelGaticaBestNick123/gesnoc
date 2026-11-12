import { describe, expect, it } from 'vitest';
import {
  guardarCobroPendiente,
  leerCobroPendiente,
  llaveDeCobro,
  montoACobrar,
  partePorPersona,
  personasQueFaltan,
  problemaDelCobro,
  propinaDe,
} from '@/modules/venta/cobro';

/** Cobra la cuenta parte por parte, como lo haría la pantalla, y devuelve cada pago. */
function dividir(saldo: number, personas: number): number[] {
  const pagos: number[] = [];
  for (let falta = personas; falta >= 1 && saldo > 0; falta--) {
    const parte = partePorPersona(saldo, falta);
    pagos.push(parte);
    saldo -= parte;
  }
  return pagos;
}

describe('HU-25: dividir el saldo en partes', () => {
  it('la última parte ajusta el saldo exacto', () => {
    expect(dividir(10000, 3)).toEqual([3340, 3330, 3330]);
    expect(dividir(19500, 4)).toEqual([4880, 4880, 4870, 4870]);
    expect(dividir(19500, 3)).toEqual([6500, 6500, 6500]);
  });

  it('para cualquier saldo, las partes suman exacto y nunca hay más pagos que personas', () => {
    for (let saldo = 1; saldo <= 60000; saldo += 37) {
      for (const personas of [2, 3, 4]) {
        const pagos = dividir(saldo, personas);
        expect(pagos.reduce((a, b) => a + b, 0)).toBe(saldo);
        expect(pagos.length).toBeLessThanOrEqual(personas);
        expect(pagos.every((parte) => parte > 0)).toBe(true);
        // Todas van a la decena salvo la última, que es lo que quede.
        expect(pagos.slice(0, -1).every((parte) => parte % 10 === 0)).toBe(true);
      }
    }
  });

  it('una sola persona paga el saldo, y sin saldo no hay parte', () => {
    expect(partePorPersona(7650, 1)).toBe(7650);
    expect(partePorPersona(0, 3)).toBe(0);
  });

  it('cuenta las partes que faltan y calcula el monto según la forma elegida', () => {
    expect(personasQueFaltan({ forma: 3, pagadas: 1 })).toBe(2);
    expect(personasQueFaltan({ forma: 2, pagadas: 5 })).toBe(1);
    expect(personasQueFaltan({ forma: 'saldo', pagadas: 0 })).toBe(1);

    expect(montoACobrar({ forma: 'saldo', pagadas: 0, libre: '' }, 19500)).toBe(19500);
    expect(montoACobrar({ forma: 'libre', pagadas: 0, libre: '5000' }, 19500)).toBe(5000);
    expect(montoACobrar({ forma: 'libre', pagadas: 0, libre: '' }, 19500)).toBe(0);
    expect(montoACobrar({ forma: 3, pagadas: 1, libre: '' }, 6660)).toBe(3330);
  });
});

describe('CU-18: propina', () => {
  it('el porcentaje se calcula sobre el monto del pago y va a la decena', () => {
    expect(propinaDe('sin', '', 19500)).toBe(0);
    expect(propinaDe(10, '', 19500)).toBe(1950);
    expect(propinaDe(10, '', 3340)).toBe(330);
    expect(propinaDe(15, '', 3350)).toBe(500);
  });

  it('el monto se toma tal cual lo escribe el garzón', () => {
    expect(propinaDe('monto', '2500', 19500)).toBe(2500);
    expect(propinaDe('monto', '', 19500)).toBe(0);
  });
});

describe('qué impide cobrar', () => {
  it('lo dice en palabras del garzón', () => {
    expect(problemaDelCobro(1000, 0, 'tarjeta')).toBe('La cuenta no tiene saldo por cobrar.');
    expect(problemaDelCobro(0, 19500, 'tarjeta')).toBe('Escribe el monto que paga.');
    expect(problemaDelCobro(19510, 19500, 'tarjeta')).toBe('El monto supera el saldo de $19.500.');
    expect(problemaDelCobro(19500, 19500, null)).toBe('Elige el medio de pago.');
    expect(problemaDelCobro(19500, 19500, 'efectivo')).toBeNull();
  });
});

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

describe('cobro sin confirmar (CU-18 4c)', () => {
  const pendiente = {
    clave: '6f1c1c2e-0d7a-4f5e-9b1a-2a3b4c5d6e7f',
    medio: 'efectivo' as const,
    monto: 5000,
    propina: 500,
  };

  it('sobrevive a una recarga con la misma clave de envío', () => {
    const almacen = almacenFalso();
    guardarCobroPendiente(almacen, '2026-11-07', 3, pendiente);
    expect(leerCobroPendiente(almacen, '2026-11-07', 3)).toEqual(pendiente);
    expect(leerCobroPendiente(almacen, '2026-11-07', 4)).toBeNull();

    guardarCobroPendiente(almacen, '2026-11-07', 3, null);
    expect(almacen.datos.size).toBe(0);
  });

  it('descarta lo de otras noches y lo que no tiene forma de cobro', () => {
    const vieja = llaveDeCobro('2026-11-06', 3);
    const almacen = almacenFalso({
      [vieja]: JSON.stringify(pendiente),
      [llaveDeCobro('2026-11-07', 3)]: JSON.stringify({ ...pendiente, monto: -1 }),
      otra: 'x',
    });
    expect(leerCobroPendiente(almacen, '2026-11-07', 3)).toBeNull();
    expect(almacen.datos.has(vieja)).toBe(false);
    expect(almacen.datos.has('otra')).toBe(true);
  });

  it('sin almacenamiento no falla', () => {
    const roto = {
      ...almacenFalso(),
      getItem: () => {
        throw new Error('modo privado');
      },
      setItem: () => {
        throw new Error('modo privado');
      },
    };
    expect(leerCobroPendiente(roto, '2026-11-07', 3)).toBeNull();
    expect(() => guardarCobroPendiente(roto, '2026-11-07', 3, pendiente)).not.toThrow();
  });
});
