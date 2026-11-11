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

/**
 * HU-22: anula una línea de un pedido de la cuenta, con autor y hora (RN-15). Si ya estaba anulada no
 * la toca; si la línea no es de esa cuenta, devuelve nulo.
 */
export async function anularLinea(
  tx: Transaccion,
  fecha: string,
  { cuenta, pedido: numero, linea }: { cuenta: number; pedido: number; linea: number },
  anuladoPor: number,
) {
  const [anulada] = await tx.execute<{ anulado_en: string }>(sql`
    update gesnoc.detalle_pedido d
    set anulado_por = ${anuladoPor}, anulado_en = now()
    from gesnoc.pedido p
    where p.fecha = d.fecha and p.numero = d.pedido_numero and p.cuenta_numero = ${cuenta}
      and d.fecha = ${fecha} and d.pedido_numero = ${numero} and d.linea = ${linea}
      and d.anulado_en is null
    returning d.anulado_en::text`);
  if (anulada) return { anuladoEn: anulada.anulado_en, yaEstaba: false };
  const [existente] = await tx.execute<{ anulado_en: string | null }>(sql`
    select d.anulado_en::text
    from gesnoc.detalle_pedido d
    join gesnoc.pedido p on p.fecha = d.fecha and p.numero = d.pedido_numero
    where d.fecha = ${fecha} and d.pedido_numero = ${numero} and d.linea = ${linea}
      and p.cuenta_numero = ${cuenta}`);
  return existente?.anulado_en ? { anuladoEn: existente.anulado_en, yaEstaba: true } : null;
}
