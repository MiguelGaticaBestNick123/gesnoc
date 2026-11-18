import { describe, expect, it } from 'vitest';
import { ayudaPorRol } from '@/modules/acceso/ayuda';
import { roles } from '@/modules/acceso/roles';

describe('ayuda «?» por rol', () => {
  it('cada rol del menú tiene entre 3 y 6 consejos cortos', () => {
    for (const rol of roles) {
      const consejos = ayudaPorRol[rol.clave];
      expect(consejos.length, rol.clave).toBeGreaterThanOrEqual(3);
      expect(consejos.length, rol.clave).toBeLessThanOrEqual(6);
      for (const consejo of consejos) expect(consejo.length, consejo).toBeLessThanOrEqual(140);
    }
  });
});
