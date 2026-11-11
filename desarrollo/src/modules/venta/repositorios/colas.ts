import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, type Transaccion } from '@/shared/db/cliente';
import { ambiente, estacion } from '@/shared/db/esquema/schema';
import type { FilaComanda, FilaLinea, TipoEstacion } from '../cola';

const columnasDeEstacion = {
  id: estacion.id,
  nombre: estacion.nombre,
  tipo: sql<TipoEstacion>`${estacion.tipo}`,
  ambienteId: estacion.ambienteId,
  ambiente: ambiente.nombre,
};

export const estacionesDelTipo = (tipo: TipoEstacion) =>
  db()
    .select(columnasDeEstacion)
    .from(estacion)
    .innerJoin(ambiente, eq(ambiente.id, estacion.ambienteId))
    .where(and(eq(estacion.tipo, tipo), eq(ambiente.activo, true)))
    .orderBy(asc(estacion.nombre));

export type Estacion = Awaited<ReturnType<typeof estacionesDelTipo>>[number];

export async function buscarEstacion(tx: Transaccion, id: number) {
  const [fila] = await tx
    .select(columnasDeEstacion)
    .from(estacion)
    .innerJoin(ambiente, eq(ambiente.id, estacion.ambienteId))
    .where(eq(estacion.id, id));
  return fila;
}

/**
 * Comandas sin entregar de una estación en la noche, con lo que necesita quien prepara: dónde está
 * el cliente, quién lo pidió y cuánto lleva esperando según el reloj del servidor.
 */
export async function comandasSinEntregar(fecha: string, estacionId: number) {
  const filas = await db().execute<{
    pedido: number;
    personas: number | null;
    espera: number;
    lista_hace: number | null;
    mesa: number | null;
    referencia: string | null;
    ambiente: string;
    garzon: string;
  }>(sql`
    select c.pedido_numero as pedido, p.personas,
           extract(epoch from now() - p.enviado_en)::int as espera,
           extract(epoch from now() - c.lista_en)::int as lista_hace,
           m.numero as mesa, cu.referencia, a.nombre as ambiente, u.nombre as garzon
    from gesnoc.comanda c
    join gesnoc.pedido p on p.fecha = c.fecha and p.numero = c.pedido_numero
    join gesnoc.cuenta cu on cu.fecha = p.fecha and cu.numero = p.cuenta_numero
    left join gesnoc.mesa m on m.id = cu.mesa_id
    join gesnoc.ambiente a on a.id = coalesce(cu.ambiente_id, m.ambiente_id)
    join gesnoc.usuario u on u.id = p.tomado_por
    where c.fecha = ${fecha} and c.estacion_id = ${estacionId} and c.entregada_en is null`);
  return filas.map(({ lista_hace, ...fila }): FilaComanda => ({ ...fila, listaHace: lista_hace }));
}

/** Líneas de esas comandas; solo las que se rutearon a esta estación (la cocina no ve bebidas). */
export async function lineasSinEntregar(fecha: string, estacionId: number) {
  const filas = await db().execute<{
    pedido: number;
    linea: number;
    producto: string;
    cantidad: number;
    nota: string | null;
    anulada_hace: number | null;
  }>(sql`
    select d.pedido_numero as pedido, d.linea, pr.nombre as producto, d.cantidad, d.nota,
           extract(epoch from now() - d.anulado_en)::int as anulada_hace
    from gesnoc.detalle_pedido d
    join gesnoc.comanda c
      on c.fecha = d.fecha and c.pedido_numero = d.pedido_numero and c.estacion_id = d.estacion_id
    join gesnoc.producto pr on pr.id = d.producto_id
    where d.fecha = ${fecha} and d.estacion_id = ${estacionId} and c.entregada_en is null`);
  return filas.map(({ anulada_hace, ...fila }): FilaLinea => ({
    ...fila,
    anuladaHace: anulada_hace,
  }));
}

/** Cuántas líneas vigentes tiene la comanda; nulo si la comanda no existe. */
export async function lineasVigentes(
  tx: Transaccion,
  fecha: string,
  pedido: number,
  estacionId: number,
): Promise<number | null> {
  const [fila] = await tx.execute<{ vigentes: number }>(sql`
    select (select count(*)::int from gesnoc.detalle_pedido d
            where d.fecha = c.fecha and d.pedido_numero = c.pedido_numero
              and d.estacion_id = c.estacion_id and d.anulado_en is null) as vigentes
    from gesnoc.comanda c
    where c.fecha = ${fecha} and c.pedido_numero = ${pedido} and c.estacion_id = ${estacionId}`);
  return fila ? fila.vigentes : null;
}

/**
 * HU-19: registra la hora solo si la comanda aún no estaba lista. Si otro dispositivo de la estación
 * ya la marcó, no se toca y se devuelve la hora que quedó (CA2).
 */
export async function marcarLista(
  tx: Transaccion,
  fecha: string,
  pedido: number,
  estacionId: number,
) {
  const donde = sql`fecha = ${fecha} and pedido_numero = ${pedido} and estacion_id = ${estacionId}`;
  const [marcada] = await tx.execute<{ lista_en: string }>(sql`
    update gesnoc.comanda set lista_en = now()
    where ${donde} and lista_en is null
    returning lista_en::text`);
  if (marcada) return { listaEn: marcada.lista_en, yaEstaba: false };
  // Otra sentencia, otra foto: ve la hora que dejó el otro dispositivo aunque haya llegado recién.
  const [existente] = await tx.execute<{ lista_en: string }>(sql`
    select lista_en::text from gesnoc.comanda where ${donde}`);
  return { listaEn: existente!.lista_en, yaEstaba: true };
}
