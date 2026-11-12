import { describe, expect, it } from 'vitest';
import { esDatoInvalido, sinDatosPersonales } from '@/shared/errores';

// Un error de consulta como los de Drizzle: el mensaje y los parámetros traen datos personales.
const errorDeConsulta = (code: string, restriccion?: string) =>
  Object.assign(
    new Error('Failed query: insert into cliente ... params: 12345678-5,Camila,Rojas'),
    {
      query: 'insert into cliente ...',
      params: ['12345678-5', 'Camila', 'Rojas'],
      cause: { code, constraint_name: restriccion },
    },
  );

describe('errores de la base en los registros del servidor (RNF-11)', () => {
  it('no dejan la consulta ni sus parámetros, solo el código y la restricción', () => {
    const limpio = sinDatosPersonales(errorDeConsulta('23505', 'cliente_documento_uq')) as Error;
    expect(limpio.message).toBe('Consulta fallida (23505, cliente_documento_uq)');
    expect(JSON.stringify(limpio)).not.toContain('12345678');
    expect(limpio.cause).toBeUndefined();
  });

  it('dejan pasar los demás errores tal cual', () => {
    const otro = new Error('otra cosa');
    expect(sinDatosPersonales(otro)).toBe(otro);
  });

  it('reconocen un dato inválido (clase 22), que se responde como 422 y no como un corte', () => {
    expect(esDatoInvalido(errorDeConsulta('22003'))).toBe(true);
    expect(esDatoInvalido(errorDeConsulta('22P02'))).toBe(true);
    expect(esDatoInvalido(errorDeConsulta('23505'))).toBe(false);
    expect(esDatoInvalido('texto')).toBe(false);
  });
});
