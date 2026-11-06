import { describe, expect, it } from 'vitest';
import {
  exigir,
  inicioDe,
  puede,
  type Actor,
  type Permiso,
  type RolTurno,
} from '@/shared/autorizacion';
import { NoAutorizado } from '@/shared/errores';

const permisos: Permiso[] = ['admin', 'garzon', 'barra', 'cocina', 'guardia', 'personal'];

const persona = (rol?: RolTurno): Actor => ({
  id: 1,
  nombre: 'Persona',
  esAdministrador: false,
  turno: rol ? { fecha: '2026-11-06', rol, ambienteId: rol === 'guardia' ? null : 1 } : null,
});

const permitidos = (actor: Actor) => permisos.filter((permiso) => puede(actor, permiso));

describe('matriz de permisos (RF-04, RN-05)', () => {
  it('la administración opera todas las pantallas, aun sin turno', () => {
    expect(permitidos({ ...persona(), esAdministrador: true })).toEqual(permisos);
  });

  it.each([
    ['garzon', 'garzon'],
    ['barman', 'barra'],
    ['cocinero', 'cocina'],
    ['guardia', 'guardia'],
  ] as const)('el rol %s solo opera %s y su calendario', (rol, pantalla) => {
    expect(permitidos(persona(rol))).toEqual([pantalla, 'personal']);
  });

  it('sin turno solo queda el calendario propio', () => {
    expect(permitidos(persona())).toEqual(['personal']);
  });
});

describe('exigir', () => {
  it('rechaza lo que no está permitido', () => {
    expect(() => exigir(persona('garzon'), 'admin')).toThrow(NoAutorizado);
  });

  it('deja pasar lo permitido', () => {
    expect(() => exigir(persona('garzon'), 'garzon')).not.toThrow();
  });
});

describe('pantalla de inicio', () => {
  it.each([
    [{ ...persona(), esAdministrador: true }, '/admin'],
    [persona('garzon'), '/garzon'],
    [persona('barman'), '/barra'],
    [persona('cocinero'), '/cocina'],
    [persona('guardia'), '/guardia'],
    [persona(), '/personal'],
  ])('dirige a cada persona a su pantalla', (actor, ruta) => {
    expect(inicioDe(actor)).toBe(ruta);
  });

  it('la administración va a su pantalla aunque tenga un turno', () => {
    expect(inicioDe({ ...persona('garzon'), esAdministrador: true })).toBe('/admin');
  });
});
