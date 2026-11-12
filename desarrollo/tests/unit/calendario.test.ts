import { describe, expect, it } from 'vitest';
import {
  diasDeLaGrilla,
  mesSiguiente,
  mesValido,
  rangoDelMes,
  tituloDeMes,
} from '@/shared/utilidades/calendario';

describe('grilla del calendario', () => {
  it('noviembre de 2026 empieza el lunes 26 de octubre y termina el domingo 6 de diciembre', () => {
    const dias = diasDeLaGrilla('2026-11');
    expect(dias[0]).toBe('2026-10-26');
    expect(dias.at(-1)).toBe('2026-12-06');
    expect(dias).toHaveLength(42);
    expect(dias.length % 7).toBe(0);
  });

  it('un mes que parte en lunes no agrega días del mes anterior', () => {
    expect(diasDeLaGrilla('2026-06')[0]).toBe('2026-06-01');
  });

  it('rango, título y navegación entre meses y años', () => {
    expect(rangoDelMes('2026-02')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(tituloDeMes('2026-11')).toBe('Noviembre 2026');
    expect(mesSiguiente('2026-12', 1)).toBe('2027-01');
    expect(mesSiguiente('2026-01', -1)).toBe('2025-12');
  });

  it('acepta solo meses válidos', () => {
    expect(mesValido('2026-11')).toBe('2026-11');
    expect(mesValido('2026-13')).toBeNull();
    expect(mesValido('noviembre')).toBeNull();
    expect(mesValido(undefined)).toBeNull();
  });
});
