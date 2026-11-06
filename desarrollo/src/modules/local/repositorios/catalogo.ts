import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';
import { categoria, producto } from '@/shared/db/esquema/schema';
import type { DatosCategoria, DatosProducto } from '../esquemas';

export const listarCategorias = () => db().select().from(categoria).orderBy(categoria.nombre);

export const listarProductos = () => db().select().from(producto).orderBy(producto.nombre);

export type Categoria = Awaited<ReturnType<typeof listarCategorias>>[number];
export type Producto = Awaited<ReturnType<typeof listarProductos>>[number];

export const insertarCategoria = (datos: DatosCategoria) => db().insert(categoria).values(datos);

export const actualizarCategoria = (id: number, datos: DatosCategoria) =>
  db().update(categoria).set(datos).where(eq(categoria.id, id));

export const eliminarCategoria = (id: number) => db().delete(categoria).where(eq(categoria.id, id));

export const insertarProducto = (datos: DatosProducto) => db().insert(producto).values(datos);

export const actualizarProducto = (id: number, datos: DatosProducto) =>
  db().update(producto).set(datos).where(eq(producto.id, id));

export const fijarProductoActivo = (id: number, activo: boolean) =>
  db().update(producto).set({ activo }).where(eq(producto.id, id));
