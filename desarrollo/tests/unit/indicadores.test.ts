import { describe, expect, it } from 'vitest';
import { completarHoras, formatoEspera } from '@/modules/caja/indicadores';

describe('las horas de la noche, sin huecos', () => {
  it('rellena con cero las horas sin datos y cruza la medianoche', () => {
    expect(
      completarHoras([
        { hora: '2026-11-07T22', total: 5000 },
        { hora: '2026-11-08T01', total: 2000 },
        { hora: '2026-11-07T23', total: 9000 },
      ]),
    ).toEqual([
      { hora: '2026-11-07T22', etiqueta: '22:00', total: 5000 },
      { hora: '2026-11-07T23', etiqueta: '23:00', total: 9000 },
      { hora: '2026-11-08T00', etiqueta: '00:00', total: 0 },
      { hora: '2026-11-08T01', etiqueta: '01:00', total: 2000 },
    ]);
  });

  it('sin datos no hay horas', () => {
    expect(completarHoras([])).toEqual([]);
  });
});

describe('esperas legibles', () => {
  it('con segundos cuando importan', () => {
    expect(formatoEspera(45.4)).toBe('45 s');
    expect(formatoEspera(270)).toBe('4 min 30 s');
    expect(formatoEspera(600)).toBe('10 min');
    expect(formatoEspera(3900)).toBe('1 h 05 min');
    expect(formatoEspera(-3)).toBe('0 s');
  });
});
