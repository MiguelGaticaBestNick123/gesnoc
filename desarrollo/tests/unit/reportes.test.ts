import { describe, expect, it } from 'vitest';
import { resumenDeReportes, TIPOS_DE_REPORTE, tiposDeReporte } from '@/modules/porteria/reportes';

describe('HU-36 CA2: el resumen de reportes que ve la puerta', () => {
  it('sin reportes no hay aviso', () => {
    expect(resumenDeReportes([])).toEqual({ total: 0, ultimo: null, expulsado: false });
  });

  it('cuenta los reportes y muestra el más reciente (el primero de la lista)', () => {
    const resumen = resumenDeReportes([
      { tipo: 'observacion' as const, numero: 2 },
      { tipo: 'advertencia' as const, numero: 1 },
    ]);
    expect(resumen).toEqual({
      total: 2,
      ultimo: { tipo: 'observacion', numero: 2 },
      expulsado: false,
    });
  });

  it('una expulsión antigua sigue marcando al cliente aunque no sea la última', () => {
    const resumen = resumenDeReportes([
      { tipo: 'observacion' as const },
      { tipo: 'expulsion' as const },
    ]);
    expect(resumen.expulsado).toBe(true);
  });

  it('cada tipo de la base tiene nombre y color', () => {
    for (const tipo of TIPOS_DE_REPORTE) {
      expect(tiposDeReporte[tipo].nombre).not.toBe('');
      expect(tiposDeReporte[tipo].color).not.toBe('');
    }
  });
});
