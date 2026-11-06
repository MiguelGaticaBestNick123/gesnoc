import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Un layout no se vuelve a ejecutar al navegar dentro de él: cada página debe protegerse sola.
const paginas = globSync('src/app/(personal)/**/page.tsx');

describe('páginas del personal', () => {
  it('se encontraron las páginas', () => {
    expect(paginas.length).toBeGreaterThan(10);
  });

  it.each(paginas)('%s exige permiso', (pagina) => {
    expect(readFileSync(pagina, 'utf8')).toContain('exigirVista(');
  });
});
