import 'server-only';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, type Transaccion } from '@/shared/db/cliente';
import {
  categoria,
  comanda,
  detallePedido,
  estacion,
  pedido,
  producto,
} from '@/shared/db/esquema/schema';

const columnasDeRuteo = {
  id: producto.id,
  nombre: producto.nombre,
  precio: producto.precio,
  activo: producto.activo,
  categoriaId: producto.categoriaId,
  categoria: categoria.nombre,
  estacionId: producto.estacionId,
  reglaRuteo: categoria.reglaRuteo,
  estacionCategoria: categoria.estacionId,
};

/** Catálogo que se puede pedir: solo productos activos (HU-06 CA3). */
export const productosActivos = () =>
  db()
    .select(columnasDeRuteo)
    .from(producto)
    .innerJoin(categoria, eq(categoria.id, producto.categoriaId))
    .where(eq(producto.activo, true))
    .orderBy(asc(categoria.nombre), asc(producto.nombre));

export const productosPorId = (tx: Transaccion, ids: number[]) =>
  tx
    .select(columnasDeRuteo)
    .from(producto)
    .innerJoin(categoria, eq(categoria.id, producto.categoriaId))
    .where(inArray(producto.id, ids));

export const estaciones = () =>
  db()
    .select({
      id: estacion.id,
      nombre: estacion.nombre,
      tipo: estacion.tipo,
      ambienteId: estacion.ambienteId,
    })
    .from(estacion);

export const estacionesPorId = (tx: Transaccion, ids: number[]) =>
  tx
    .select({ id: estacion.id, nombre: estacion.nombre, tipo: estacion.tipo })
    .from(estacion)
    .where(inArray(estacion.id, ids))
    .orderBy(asc(estacion.nombre));

export async function barraDe(tx: Transaccion, ambienteId: number): Promise<number | null> {
  const [fila] = await tx
    .select({ id: estacion.id })
    .from(estacion)
    .where(and(eq(estacion.ambienteId, ambienteId), eq(estacion.tipo, 'barra')));
  return fila?.id ?? null;
}

/** El pedido que ya se registró con esta clave de envío, con las estaciones a las que fue. */
export async function pedidoPorClave(tx: Transaccion, claveEnvio: string) {
  const [registrado] = await tx
    .select({ fecha: pedido.fecha, numero: pedido.numero })
    .from(pedido)
    .where(eq(pedido.claveEnvio, claveEnvio));
  if (!registrado) return undefined;
  const destinos = await tx
    .select({ nombre: estacion.nombre })
    .from(comanda)
    .innerJoin(estacion, eq(estacion.id, comanda.estacionId))
    .where(and(eq(comanda.fecha, registrado.fecha), eq(comanda.pedidoNumero, registrado.numero)))
    .orderBy(asc(estacion.nombre));
  return { numero: registrado.numero, estaciones: destinos.map((d) => d.nombre) };
}

export async function siguientePedido(tx: Transaccion, fecha: string): Promise<number> {
  const [ultimo] = await tx
    .select({ numero: sql<number>`coalesce(max(${pedido.numero}), 0)::int` })
    .from(pedido)
    .where(eq(pedido.fecha, fecha));
  return (ultimo?.numero ?? 0) + 1;
}

interface NuevoPedido {
  fecha: string;
  numero: number;
  cuentaNumero: number;
  tomadoPor: number;
  personas: number | null;
  claveEnvio: string;
  lineas: {
    productoId: number;
    estacionId: number;
    cantidad: number;
    precioUnitario: number;
    nota: string | null;
  }[];
}

// Un pedido, una comanda por estación (RN-11) y sus líneas, cada una ligada a la comanda de su estación.
export async function insertarPedido(tx: Transaccion, { lineas, ...datos }: NuevoPedido) {
  const { fecha, numero } = datos;
  await tx.insert(pedido).values(datos);
  const destinos = [...new Set(lineas.map((linea) => linea.estacionId))];
  await tx
    .insert(comanda)
    .values(destinos.map((estacionId) => ({ fecha, pedidoNumero: numero, estacionId })));
  await tx
    .insert(detallePedido)
    .values(
      lineas.map((linea, indice) => ({ fecha, pedidoNumero: numero, linea: indice + 1, ...linea })),
    );
}
