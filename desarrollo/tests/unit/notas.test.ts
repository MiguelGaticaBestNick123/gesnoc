import { describe, expect, it } from 'vitest';
import { agregarANota, esAlergia, LARGO_NOTA } from '@/modules/venta/notas';

describe('notas rápidas del pedido', () => {
  it('agrega el atajo separado por coma y no lo repite', () => {
    expect(agregarANota('', 'Sin hielo')).toBe('Sin hielo');
    expect(agregarANota('Sin hielo', 'Doble')).toBe('Sin hielo, Doble');
    expect(agregarANota('sin hielo, Doble', 'Sin hielo')).toBe('sin hielo, Doble');
  });

  it('no pasa el largo máximo de la nota', () => {
    const larga = 'x'.repeat(LARGO_NOTA - 3);
    expect(agregarANota(larga, 'Sin hielo')).toBe(larga);
  });
});

describe('alergias en la estación', () => {
  it('reconoce una alergia aunque la escriban sin tilde o con mayúsculas', () => {
    expect(esAlergia('Alergia: maní')).toBe(true);
    expect(esAlergia('ALERGICO al gluten')).toBe(true);
    expect(esAlergia('es celíaca')).toBe(true);
    expect(esAlergia('Sin hielo')).toBe(false);
    expect(esAlergia(null)).toBe(false);
  });
});
