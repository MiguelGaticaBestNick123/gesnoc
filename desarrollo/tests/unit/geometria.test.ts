import { describe, expect, it } from 'vitest';
import {
  cambiarForma,
  escalaParaAjustar,
  ladoDeToque,
  lugarLibre,
  MARGEN,
  mover,
  numerosRepetidos,
  redimensionar,
  repartirSillas,
  siguienteNumero,
  sillasDe,
  sillasSegunTamano,
  type Mesa,
} from '@/modules/local/geometria';
import { duracion, fechaCorta } from '@/shared/utilidades/fechas';

const mesa = (cambios: Partial<Mesa> = {}): Mesa => ({
  id: 1,
  numero: 1,
  forma: 'rectangular',
  posX: 100,
  posY: 100,
  ancho: 110,
  alto: 80,
  rotacion: 0,
  ...cambios,
});

const plano = { ancho: 900, alto: 440 };

describe('sillas alrededor de cada mesa', () => {
  it('una mesa larga lleva más sillas por lado', () => {
    expect(sillasDe(mesa({ ancho: 110, alto: 80 }))).toHaveLength(6);
    expect(sillasDe(mesa({ ancho: 180, alto: 90 }))).toHaveLength(8);
  });

  it('una mesa redonda reparte sus sillas en el círculo según su tamaño', () => {
    expect(sillasDe(mesa({ forma: 'redonda', ancho: 100, alto: 100 }))).toHaveLength(7);
    expect(sillasDe(mesa({ forma: 'redonda', ancho: 40, alto: 40 }))).toHaveLength(4);
  });
});

describe('ajustar el plano a la pantalla', () => {
  it('en un teléfono el plano completo cabe en el ancho', () => {
    const escala = escalaParaAjustar(plano, { ancho: 328 });
    expect((plano.ancho + 2 * MARGEN) * escala).toBeCloseTo(328);
  });

  it('a pantalla completa cabe también en el alto', () => {
    const escala = escalaParaAjustar(plano, { ancho: 780, alto: 300 });
    expect((plano.alto + 2 * MARGEN) * escala).toBeCloseTo(300);
    expect((plano.ancho + 2 * MARGEN) * escala).toBeLessThan(780);
  });

  it('RNF-09: el área de toque mide 44 px en pantalla aunque la mesa se vea chica', () => {
    const escala = escalaParaAjustar(plano, { ancho: 328 });
    expect(ladoDeToque(escala) * escala).toBeCloseTo(44);
  });
});

describe('editor del plano (HU-05)', () => {
  it('mover ajusta a la grilla de 10 y no deja salir la mesa del plano', () => {
    expect(mover(mesa(), 123, 87, plano)).toMatchObject({ posX: 120, posY: 90 });
    expect(mover(mesa(), -50, 9999, plano)).toMatchObject({ posX: 0, posY: 360 });
  });

  it('redimensionar respeta el rango de 20 a 400', () => {
    expect(redimensionar(mesa(), 5, 999)).toMatchObject({ ancho: 20, alto: 400 });
  });

  it('una mesa cuadrada o redonda mantiene ancho y alto iguales (mesa_proporcion_ck)', () => {
    expect(redimensionar(mesa({ forma: 'cuadrada' }), 90, 130)).toMatchObject({
      ancho: 130,
      alto: 130,
    });
    expect(cambiarForma(mesa({ ancho: 110, alto: 80 }), 'redonda')).toMatchObject({
      forma: 'redonda',
      ancho: 110,
      alto: 110,
    });
  });

  it('CA2: detecta números repetidos y propone el siguiente libre', () => {
    const mesas = [{ numero: 1 }, { numero: 4 }, { numero: 4 }, { numero: 2 }];
    expect(numerosRepetidos(mesas)).toEqual([4]);
    expect(siguienteNumero(mesas)).toBe(5);
  });
});

describe('textos de tiempo', () => {
  it('fecha corta de la noche', () => {
    expect(fechaCorta('2026-11-07')).toBe('sáb 7 nov');
  });

  it('tiempo transcurrido legible', () => {
    expect(duracion(59)).toBe('0 min');
    expect(duracion(12 * 60 + 5)).toBe('12 min');
    expect(duracion(63 * 60)).toBe('1 h 03 min');
  });
});

describe('mesa nueva en el editor', () => {
  it('se ubica en el primer lugar libre, sin pisar otra mesa ni sus sillas', () => {
    const ocupadas = [mesa({ posX: 20, posY: 20, ancho: 110, alto: 80 })];
    const lugar = lugarLibre(ocupadas, plano, 80, 80);
    expect(lugar.posX).toBeGreaterThanOrEqual(20 + 110 + 30);
    expect(lugar.posY).toBe(20);
  });

  it('si el plano está lleno, queda en la esquina', () => {
    const llena = [mesa({ posX: 0, posY: 0, ancho: 400, alto: 400 })];
    expect(lugarLibre(llena, { ancho: 420, alto: 420 }, 80, 80)).toEqual({ posX: 0, posY: 0 });
  });
});

describe('sillas fijas por mesa', () => {
  it('reparte las sillas según el largo de cada lado', () => {
    expect(repartirSillas(4, 80, 80)).toEqual({ arriba: 1, abajo: 1, izquierda: 1, derecha: 1 });
    expect(repartirSillas(4, 160, 80)).toEqual({ arriba: 2, abajo: 2, izquierda: 0, derecha: 0 });
    expect(repartirSillas(6, 110, 80)).toEqual({ arriba: 2, abajo: 2, izquierda: 1, derecha: 1 });
  });

  it('la cantidad fija no cambia aunque la mesa se agrande o se achique', () => {
    for (const lado of [60, 120, 300]) {
      expect(
        sillasDe(mesa({ forma: 'cuadrada', ancho: lado, alto: lado, sillas: 4 })),
      ).toHaveLength(4);
      expect(sillasDe(mesa({ forma: 'redonda', ancho: lado, alto: lado, sillas: 6 }))).toHaveLength(
        6,
      );
    }
  });

  it('cero sillas dibuja la mesa sola; sin cantidad fija, las que caben', () => {
    expect(sillasDe(mesa({ sillas: 0 }))).toHaveLength(0);
    expect(sillasDe(mesa({ ancho: 110, alto: 80, sillas: null }))).toHaveLength(
      sillasSegunTamano(mesa({ ancho: 110, alto: 80 })),
    );
  });
});
