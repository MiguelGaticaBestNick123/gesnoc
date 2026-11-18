import { describe, expect, it } from 'vitest';
import { elegirGanador, nombrePublico } from '@/modules/porteria/ganador';

describe('HU-37 sorteo', () => {
  it('el azar elige uno de los tickets que participan (RN-23)', () => {
    expect(elegirGanador([4, 9, 15], () => 2)).toBe(15);
    expect(() => elegirGanador([], () => 0)).toThrow('No hay tickets para sortear');
  });

  it('en la pantalla proyectada, el ganador es su nombre y la inicial del apellido (RN-25)', () => {
    expect(nombrePublico('Camila', 'Rojas')).toBe('Camila R.');
    expect(nombrePublico(' María José ', 'de la Fuente')).toBe('María D.');
    expect(nombrePublico('Ignacio', 'Ñúñez')).toBe('Ignacio Ñ.');
    expect(nombrePublico('Anónimo', '')).toBe('Anónimo');
  });
});
