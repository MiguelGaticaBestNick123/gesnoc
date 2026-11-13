// Lógica pura de la carta pública (HU-38) y de sus códigos QR (HU-07).

/** El formato del código de la mesa, el mismo que exige la base (`mesa.token_qr`). */
const FORMATO_CODIGO = /^[A-Za-z0-9_-]{22,64}$/;

/** Un código con otro formato no se consulta: no existe. */
export const esCodigoDeMesa = (codigo: string) => FORMATO_CODIGO.test(codigo);

export interface ProductoCarta {
  id: number;
  nombre: string;
  precio: number;
}

export interface CategoriaCarta {
  id: number;
  nombre: string;
  productos: ProductoCarta[];
}

/** HU-38 CA2: la carta se puede ordenar por precio; sin elegir, va por nombre. */
export type OrdenCarta = 'nombre' | 'menor' | 'mayor';

const porNombre = (a: ProductoCarta, b: ProductoCarta) => a.nombre.localeCompare(b.nombre, 'es');

/** Ordena los productos de una categoría; con el mismo precio, por nombre. */
export function ordenarProductos(productos: ProductoCarta[], orden: OrdenCarta): ProductoCarta[] {
  const copia = [...productos];
  if (orden === 'nombre') return copia.sort(porNombre);
  const signo = orden === 'menor' ? 1 : -1;
  return copia.sort((a, b) => signo * (a.precio - b.precio) || porNombre(a, b));
}

/** Agrupa las filas de productos activos por su categoría, conservando el orden de llegada. */
export function agruparPorCategoria(
  filas: { categoriaId: number; categoria: string; id: number; nombre: string; precio: number }[],
): CategoriaCarta[] {
  const categorias = new Map<number, CategoriaCarta>();
  for (const { categoriaId, categoria, ...producto } of filas) {
    const grupo = categorias.get(categoriaId) ?? {
      id: categoriaId,
      nombre: categoria,
      productos: [],
    };
    grupo.productos.push(producto);
    categorias.set(categoriaId, grupo);
  }
  return [...categorias.values()];
}

/**
 * El origen con que la persona abrió la aplicación, para armar el enlace del QR. Detrás del proxy de
 * Railway llegan `x-forwarded-host` y `x-forwarded-proto`; en la red del local (`npm run local`) no
 * hay proxy y es HTTP.
 */
export function origenDe(cabeceras: { get(nombre: string): string | null }): string {
  const primero = (nombre: string) => cabeceras.get(nombre)?.split(',')[0]?.trim() || undefined;
  const host = primero('x-forwarded-host') ?? primero('host') ?? 'localhost:3000';
  const protocolo = primero('x-forwarded-proto') ?? 'http';
  return `${protocolo}://${host}`;
}

export const enlaceDeCarta = (origen: string, codigo: string) => `${origen}/carta/${codigo}`;
