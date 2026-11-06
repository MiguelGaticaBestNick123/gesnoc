import { describe, expect, it } from 'vitest';
import { gruposDe, historiasFueraDelMenu, roles, rutaDe } from '@/modules/acceso/roles';

const secciones = roles.flatMap((rol) => rol.secciones);
const admin = roles.find((rol) => rol.clave === 'admin')!;

describe('menús por rol', () => {
  it('cada historia planificada tiene una pantalla', () => {
    const cubiertas = new Set([
      ...historiasFueraDelMenu,
      ...secciones.flatMap((seccion) => seccion.historias ?? []),
    ]);
    const planificadas = Array.from(
      { length: 40 },
      (_, i) => `HU-${String(i + 1).padStart(2, '0')}`,
    );

    expect(planificadas.filter((historia) => !cubiertas.has(historia))).toEqual([]);
    expect(cubiertas.has('HU-41')).toBe(false);
  });

  it('todos tienen calendario y nadie repite una ruta', () => {
    for (const rol of roles) {
      const rutas = rol.secciones.map((seccion) => rutaDe(rol, seccion));
      expect(new Set(rutas).size).toBe(rutas.length);
      expect(rol.secciones.some((s) => s.historias?.includes('HU-09'))).toBe(true);
    }
  });

  it('la administración llega a las pantallas de los demás roles (RF-04)', () => {
    const destinos = admin.secciones.flatMap((s) => (s.destino ? [s.destino] : []));
    expect(destinos).toEqual(['/garzon', '/barra', '/cocina', '/guardia']);
  });

  it('agrupa las secciones en el orden del menú', () => {
    expect(gruposDe(admin).map((grupo) => grupo.titulo)).toEqual([
      undefined,
      'Noche',
      'Caja',
      'Local',
      'Personas',
      'Operación',
      'Mi cuenta',
    ]);
  });
});
