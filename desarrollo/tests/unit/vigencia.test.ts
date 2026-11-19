import { describe, expect, it } from 'vitest';
import { datosLista } from '@/modules/noche/esquemas';
import {
  describirVigencia,
  duracionDe,
  nocheAnterior,
  terminada,
  vigenteEn,
} from '@/modules/noche/vigencia';
import { elegirReconocimiento, type Reconocimiento } from '@/modules/porteria/reconocimiento';

// Listas con vigencia (pedido del Product Owner, 18 nov): una noche, varias o sin término.

const cumpleanos = { desde: '2026-11-20', hasta: '2026-11-20' };
const temporada = { desde: '2026-11-20', hasta: '2026-12-31' };
const frecuentes = { desde: '2026-11-01', hasta: null };

describe('vigencia de una lista', () => {
  it('distingue una noche, varias y sin término', () => {
    expect(duracionDe(cumpleanos)).toBe('noche');
    expect(duracionDe(temporada)).toBe('hasta');
    expect(duracionDe(frecuentes)).toBe('siempre');
  });

  it('vale desde su primera noche hasta la última, ambas incluidas', () => {
    expect(vigenteEn(cumpleanos, '2026-11-20')).toBe(true);
    expect(vigenteEn(cumpleanos, '2026-11-21')).toBe(false);
    expect(vigenteEn(temporada, '2026-11-19')).toBe(false);
    expect(vigenteEn(temporada, '2026-12-31')).toBe(true);
    expect(vigenteEn(temporada, '2027-01-01')).toBe(false);
    // La lista sin término vale cualquier noche desde que empieza.
    expect(vigenteEn(frecuentes, '2031-06-13')).toBe(true);
    expect(vigenteEn(frecuentes, '2026-10-31')).toBe(false);
  });

  it('termina cuando pasa su última noche; la sin término nunca', () => {
    expect(terminada(cumpleanos, '2026-11-20')).toBe(false);
    expect(terminada(cumpleanos, '2026-11-21')).toBe(true);
    expect(terminada(frecuentes, '2040-01-01')).toBe(false);
  });

  it('la noche anterior cruza meses y años', () => {
    expect(nocheAnterior('2026-12-01')).toBe('2026-11-30');
    expect(nocheAnterior('2027-01-01')).toBe('2026-12-31');
  });

  it('se describe como se dice en el local', () => {
    expect(describirVigencia(cumpleanos)).toBe('Solo el viernes 20 de noviembre');
    expect(describirVigencia(cumpleanos, '2026-11-20')).toBe('Solo esta noche');
    expect(describirVigencia(temporada)).toBe('Del 20 de noviembre al 31 de diciembre');
    expect(describirVigencia({ desde: '2026-12-20', hasta: '2027-01-15' })).toBe(
      'Del 20 de diciembre al 15 de enero de 2027',
    );
    expect(describirVigencia(frecuentes, '2026-11-20')).toBe(
      'Sin término, desde el 1 de noviembre',
    );
  });
});

describe('formulario de una lista', () => {
  const base = {
    nombre: 'Clientes frecuentes',
    responsable: 'Carla Muñoz',
    gratis: 'on',
    desde: '2026-11-20',
  };

  it('una noche termina la misma noche; sin término no tiene última noche', () => {
    expect(datosLista.parse({ ...base, duracion: 'noche' })).toEqual({
      id: null,
      nombre: 'Clientes frecuentes',
      responsable: 'Carla Muñoz',
      gratis: true,
      desde: '2026-11-20',
      hasta: '2026-11-20',
    });
    expect(datosLista.parse({ ...base, duracion: 'siempre', hasta: '2026-12-01' })).toMatchObject({
      hasta: null,
    });
    expect(
      datosLista.parse({ ...base, id: '7', duracion: 'hasta', hasta: '2026-12-31' }),
    ).toMatchObject({ id: 7, hasta: '2026-12-31' });
  });

  it('varias noches exige una última noche que no sea antes de la primera', () => {
    const mensaje = (datos: Record<string, string>) =>
      datosLista.safeParse({ ...base, ...datos }).error?.issues[0]?.message;
    expect(mensaje({ duracion: 'hasta' })).toBe('Elige hasta qué noche vale la lista');
    expect(mensaje({ duracion: 'hasta', hasta: '2026-11-19' })).toBe(
      'La lista no puede terminar antes de empezar',
    );
    expect(mensaje({ duracion: 'para siempre' })).toBe('Elige cuánto dura la lista');
  });
});

describe('HU-33: lo que la puerta muestra de una persona', () => {
  const de = (datos: Partial<Reconocimiento>): Reconocimiento => ({
    nombre: 'Paz',
    apellido: 'Cifuentes',
    gratis: false,
    invitadoPor: null,
    listaId: 1,
    lista: 'Lista',
    responsable: 'Alguien',
    noches: 1,
    ...datos,
  });

  it('sin invitación ni lista, nada', () => {
    expect(elegirReconocimiento([])).toBeUndefined();
  });

  it('primero lo que la deja entrar gratis', () => {
    const cumpleanos = de({ listaId: 1, lista: 'Cumpleaños de Camila', gratis: false });
    const frecuentes = de({ listaId: 2, lista: 'Clientes frecuentes', gratis: true, noches: null });
    expect(elegirReconocimiento([cumpleanos, frecuentes])?.lista).toBe('Clientes frecuentes');
  });

  it('entre iguales, la invitación de esta noche y después la lista más acotada', () => {
    const frecuentes = de({ listaId: 2, lista: 'Clientes frecuentes', gratis: true, noches: null });
    const temporada = de({
      listaId: 3,
      lista: 'Bailarines de temporada',
      gratis: true,
      noches: 40,
    });
    const bailarines = de({ listaId: 4, lista: 'Bailarines', gratis: true, noches: 1 });
    const delDj = de({ listaId: null, lista: null, invitadoPor: 'DJ', gratis: true, noches: null });
    expect(elegirReconocimiento([frecuentes, temporada, bailarines])?.lista).toBe('Bailarines');
    expect(elegirReconocimiento([frecuentes, temporada])?.lista).toBe('Bailarines de temporada');
    expect(elegirReconocimiento([frecuentes, delDj, bailarines])?.invitadoPor).toBe('DJ');
  });
});
