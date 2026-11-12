import { describe, expect, it } from 'vitest';
import { datosInvitacion, datosPremio } from '@/modules/noche/esquemas';
import { leerLista, ordenNocturno } from '@/modules/noche/listas';
import {
  digitoVerificador,
  formatearDocumento,
  normalizarDocumento,
  normalizarExtranjero,
  normalizarRut,
} from '@/shared/utilidades/rut';

describe('RUT (RN-21)', () => {
  it('calcula el dígito verificador con módulo 11, incluidos el 0 y la K', () => {
    expect(digitoVerificador('12345678')).toBe('5');
    expect(digitoVerificador('16543210')).toBe('K');
    expect(digitoVerificador('19876543')).toBe('0');
  });

  it.each(['12.345.678-5', '12345678-5', '123456785', ' 12 345 678 - 5 ', '012.345.678-5'])(
    'normaliza «%s» sin puntos y con guion',
    (texto) => {
      expect(normalizarRut(texto)).toBe('12345678-5');
    },
  );

  it('la K se guarda en mayúscula', () => {
    expect(normalizarRut('16.543.210-k')).toBe('16543210-K');
  });

  it('rechaza un dígito verificador equivocado y lo que no es un RUT', () => {
    expect(normalizarRut('12.345.678-9')).toBeNull();
    expect(normalizarRut('1234-5')).toBeNull();
    expect(normalizarRut('ABC')).toBeNull();
    expect(normalizarRut('')).toBeNull();
  });

  it('un documento extranjero queda en mayúsculas, sin signos, de 4 a 15', () => {
    expect(normalizarExtranjero('ab-123 456')).toBe('AB123456');
    expect(normalizarExtranjero('AB1')).toBeNull();
    expect(normalizarDocumento('extranjero', 'p 1234567')).toBe('P1234567');
  });

  it('un documento extranjero no puede parecerse a uno anonimizado (RN-25)', () => {
    expect(normalizarExtranjero('ANON12')).toBeNull();
    expect(normalizarExtranjero('anon-12')).toBeNull();
  });

  it('el tipo lo elige quien registra: un pasaporte de números no se toma como RUT', () => {
    expect(normalizarDocumento('extranjero', '123456785')).toBe('123456785');
    expect(normalizarDocumento('rut', '123456785')).toBe('12345678-5');
  });

  it('muestra el RUT con puntos y el documento extranjero tal cual', () => {
    expect(formatearDocumento('12345678-5')).toBe('12.345.678-5');
    expect(formatearDocumento('1234567-4')).toBe('1.234.567-4');
    expect(formatearDocumento('AB123456')).toBe('AB123456');
  });
});

describe('lista pegada', () => {
  it('lee el RUT y el nombre en cualquier orden, con puntos, comas y viñetas', () => {
    const { personas, errores } = leerLista(
      [
        '12.345.678-5 Camila Rojas',
        'Ignacio Bravo Soto, 17654321-3',
        '',
        '- RUT: 18.234.567-9 Fernanda Lagos',
        '3) 19876543-0 Javiera Soto',
      ].join('\n'),
    );
    expect(errores).toEqual([]);
    expect(personas).toEqual([
      { documento: '12345678-5', nombre: 'Camila', apellido: 'Rojas' },
      { documento: '17654321-3', nombre: 'Ignacio', apellido: 'Bravo Soto' },
      { documento: '18234567-9', nombre: 'Fernanda', apellido: 'Lagos' },
      { documento: '19876543-0', nombre: 'Javiera', apellido: 'Soto' },
    ]);
  });

  it('informa cada línea que no se entiende, con su número', () => {
    const { errores } = leerLista(
      [
        '12.345.678-9 Camila Rojas',
        'Ignacio Bravo',
        '17654321-3 Ignacio',
        '17.654.321-3 Otro Más',
        '17654321-3 Repetido Igual',
      ].join('\n'),
    );
    expect(errores).toEqual([
      'Línea 1: falta un RUT válido',
      'Línea 2: falta un RUT válido',
      'Línea 3: falta el nombre o el apellido',
      'Línea 5: el RUT 17654321-3 está repetido',
    ]);
  });

  it('un texto vacío no es una lista', () => {
    expect(leerLista('  \n ').errores).toEqual(['Pega al menos una persona']);
  });
});

describe('detalles de la noche', () => {
  it('ordena las horas como una noche: lo de después de medianoche va al final', () => {
    const horas = ['01:00', null, '23:30', '02:30', '22:00'];
    expect(horas.toSorted((a, b) => ordenNocturno(a) - ordenNocturno(b))).toEqual([
      '22:00',
      '23:30',
      '01:00',
      '02:30',
      null,
    ]);
  });

  const fecha = '2026-11-07';

  it('una invitación individual exige quién invita; la de una lista, no', () => {
    const persona = { fecha, documento: '16.543.210-k', nombre: 'Felipe', apellido: 'Araya' };
    expect(datosInvitacion.safeParse(persona).success).toBe(false);
    expect(datosInvitacion.parse({ ...persona, invitadoPor: 'DJ', gratis: 'on' })).toMatchObject({
      documento: '16543210-K',
      listaNumero: null,
      invitadoPor: 'DJ',
      gratis: true,
    });
    expect(datosInvitacion.parse({ ...persona, listaNumero: '2', gratis: 'on' })).toMatchObject({
      listaNumero: 2,
      invitadoPor: null,
      gratis: null,
    });
  });

  it('rechaza un RUT inválido en una invitación', () => {
    const resultado = datosInvitacion.safeParse({
      fecha,
      documento: '16.543.210-1',
      nombre: 'Felipe',
      apellido: 'Araya',
      listaNumero: '1',
    });
    expect(resultado.error?.issues[0]?.message).toMatch(/RUT no válido/);
  });

  it('el premio admite hasta cinco productos sin repetir, de 1 a 10 unidades', () => {
    const premio = (items: unknown) =>
      datosPremio.safeParse({ fecha, ambienteId: '1', items: JSON.stringify(items) });
    expect(premio([{ productoId: 3, cantidad: 2 }]).success).toBe(true);
    expect(premio([]).success).toBe(true);
    expect(premio([{ productoId: 3, cantidad: 11 }]).success).toBe(false);
    expect(
      premio([
        { productoId: 3, cantidad: 1 },
        { productoId: 3, cantidad: 1 },
      ]).success,
    ).toBe(false);
    expect(datosPremio.safeParse({ fecha, ambienteId: '1', items: 'no es json' }).success).toBe(
      false,
    );
  });
});
