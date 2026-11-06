import { describe, expect, it } from 'vitest';
import { formatearFecha, tituloDeFecha } from '@/shared/utilidades/fechas';

describe('formatearFecha', () => {
  it('muestra el día de la fecha operativa sin correrlo por la zona horaria', () => {
    expect(formatearFecha('2026-11-06')).toBe('viernes, 6 de noviembre');
  });

  it('como título solo lleva mayúscula la primera letra', () => {
    expect(tituloDeFecha('2026-11-06')).toBe('Viernes, 6 de noviembre');
  });
});
