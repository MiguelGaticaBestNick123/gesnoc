import { describe, expect, it } from 'vitest';
import { formatearPesos } from '@/shared/utilidades/dinero';

describe('formatearPesos', () => {
  it('muestra pesos chilenos sin decimales y con separador de miles', () => {
    expect(formatearPesos(77000)).toMatch(/^\$\s?77\.000$/);
  });

  it('rechaza montos con decimales', () => {
    expect(() => formatearPesos(1500.5)).toThrow(RangeError);
  });
});
