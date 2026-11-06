import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { CLAVE_FORANEA, traducir } from '@/shared/errores';
import type { DatosCategoria, DatosProducto } from '../esquemas';
import { listarEstaciones } from '../repositorios/ambientes';
import * as repositorio from '../repositorios/catalogo';

const restriccionesCategoria = {
  categoria_nombre_uq: 'Ya existe una categoría con ese nombre',
  [CLAVE_FORANEA]: 'Esta categoría tiene productos: muévelos a otra antes de eliminarla',
};

const productoRepetido = { producto_nombre_uq: 'Ya existe un producto con ese nombre' };

export async function listar(actor: Actor) {
  exigir(actor, 'admin');
  const [categorias, productos, estaciones] = await Promise.all([
    repositorio.listarCategorias(),
    repositorio.listarProductos(),
    listarEstaciones(),
  ]);
  return { categorias, productos, estaciones };
}

export async function crearCategoria(actor: Actor, datos: DatosCategoria) {
  exigir(actor, 'admin');
  await traducir(repositorio.insertarCategoria(datos), restriccionesCategoria);
}

export async function editarCategoria(actor: Actor, id: number, datos: DatosCategoria) {
  exigir(actor, 'admin');
  await traducir(repositorio.actualizarCategoria(id, datos), restriccionesCategoria);
}

export async function eliminarCategoria(actor: Actor, id: number) {
  exigir(actor, 'admin');
  await traducir(repositorio.eliminarCategoria(id), restriccionesCategoria);
}

export async function crearProducto(actor: Actor, datos: DatosProducto) {
  exigir(actor, 'admin');
  await traducir(repositorio.insertarProducto(datos), productoRepetido);
}

export async function editarProducto(actor: Actor, id: number, datos: DatosProducto) {
  exigir(actor, 'admin');
  await traducir(repositorio.actualizarProducto(id, datos), productoRepetido);
}

export async function cambiarProductoActivo(actor: Actor, id: number, activo: boolean) {
  exigir(actor, 'admin');
  await repositorio.fijarProductoActivo(id, activo);
}
