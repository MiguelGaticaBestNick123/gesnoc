import { describe, expect, it } from 'vitest';
import { ordenarParaRol, rolPrincipal } from '@/modules/noche/recomendacion';

describe('rol habitual', () => {
  it('es el rol que más veces ha tenido la persona', () => {
    expect(
      rolPrincipal([
        { rol: 'garzon', veces: 2, ultima: '2026-11-07' },
        { rol: 'guardia', veces: 5, ultima: '2026-10-30' },
      ]),
    ).toBe('guardia');
  });

  it('si empatan, gana el más reciente; sin historial no hay', () => {
    expect(
      rolPrincipal([
        { rol: 'barman', veces: 3, ultima: '2026-10-24' },
        { rol: 'garzon', veces: 3, ultima: '2026-11-07' },
      ]),
    ).toBe('garzon');
    expect(rolPrincipal([])).toBeNull();
  });
});

describe('orden al asignar un rol', () => {
  const persona = (nombre: string, cambios: object = {}) => ({
    nombre,
    principal: null,
    disponible: false,
    rol: null,
    veces: {},
    ...cambios,
  });

  it('arriba las habituales del rol; abajo todas las demás, para poder rotar', () => {
    const { habituales, otras } = ordenarParaRol(
      [
        persona('Diego', { principal: 'garzon' }),
        persona('Bruno', { principal: 'guardia' }),
        persona('Lucía'),
        persona('Ana', { principal: 'guardia' }),
      ],
      'guardia',
    );
    expect(habituales.map((p) => p.nombre)).toEqual(['Ana', 'Bruno']);
    expect(otras.map((p) => p.nombre)).toEqual(['Diego', 'Lucía']);
  });

  it('en cada grupo van primero quienes postularon, luego las de más experiencia en el rol', () => {
    const { habituales } = ordenarParaRol(
      [
        persona('Ana', { principal: 'garzon', veces: { garzon: 2 } }),
        persona('Bruno', { principal: 'garzon', veces: { garzon: 9 } }),
        persona('Carla', { principal: 'garzon', disponible: true, veces: { garzon: 1 } }),
      ],
      'garzon',
    );
    expect(habituales.map((p) => p.nombre)).toEqual(['Carla', 'Bruno', 'Ana']);
  });
});
