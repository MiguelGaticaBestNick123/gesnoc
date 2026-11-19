import { describe, expect, it } from 'vitest';
import { componerNota, leerNota } from '@/modules/noche/nota';

// Nota para el equipo con promociones predeterminadas (pedido del Product Owner, 18 nov).

describe('nota de la noche', () => {
  it('arma las promociones en su orden y después la nota libre', () => {
    expect(
      componerNota({
        promociones: { todos: '23:30', cover: '01:00' },
        otra: '  Llegar a las 21:30 ',
      }),
    ).toBe('Cover hasta las 01:00 · Todos gratis hasta las 23:30 · Llegar a las 21:30');
    expect(componerNota({ promociones: {}, otra: '' })).toBe('');
    // Una hora a medio escribir no entra.
    expect(componerNota({ promociones: { mujeres: '1:' }, otra: 'Show' })).toBe('Show');
  });

  it('reconoce de vuelta las promociones al editar; lo demás queda como nota libre', () => {
    expect(
      leerNota('Entrada 2x1 hasta las 00:30 · Mujeres gratis hasta las 01:15 · DJ invitado'),
    ).toEqual({ promociones: { dosPorUno: '00:30', mujeres: '01:15' }, otra: 'DJ invitado' });
    expect(leerNota('Entrada gratis hasta las 00:00')).toEqual({
      promociones: {},
      otra: 'Entrada gratis hasta las 00:00',
    });
    expect(leerNota(null)).toEqual({ promociones: {}, otra: '' });
  });

  it('leer y volver a armar deja la misma nota', () => {
    const nota = 'Cover hasta las 02:00 · Aniversario del local · Música en vivo';
    expect(componerNota(leerNota(nota))).toBe(nota);
  });
});
