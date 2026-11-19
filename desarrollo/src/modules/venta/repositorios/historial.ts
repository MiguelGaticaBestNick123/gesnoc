import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';
import type { FilaHistorial, FilaLineaHistorial } from '../historial';

// Las horas se escriben en la hora de Chile: es la que se ve en el local.
const horaChile = (columna: SQL) =>
  sql`to_char(${columna} at time zone 'America/Santiago', 'HH24:MI')`;

/** Todas las comandas de la noche, con su pedido, dónde está el cliente y quién lo tomó. */
export async function comandasDeLaNoche(fecha: string): Promise<FilaHistorial[]> {
  const filas = await db().execute<{
    pedido: number;
    estacion_id: number;
    estacion: string;
    hora: string;
    lista: string | null;
    entregada: string | null;
    personas: number | null;
    mesa: number | null;
    referencia: string | null;
    ambiente: string;
    garzon: string;
  }>(sql`
    select c.pedido_numero as pedido, c.estacion_id, e.nombre as estacion,
           ${horaChile(sql`p.enviado_en`)} as hora,
           ${horaChile(sql`c.lista_en`)} as lista,
           ${horaChile(sql`c.entregada_en`)} as entregada,
           p.personas, m.numero as mesa, cu.referencia, a.nombre as ambiente,
           u.nombre as garzon
    from gesnoc.comanda c
    join gesnoc.estacion e on e.id = c.estacion_id
    join gesnoc.pedido p on p.fecha = c.fecha and p.numero = c.pedido_numero
    join gesnoc.cuenta cu on cu.fecha = p.fecha and cu.numero = p.cuenta_numero
    left join gesnoc.mesa m on m.id = cu.mesa_id
    join gesnoc.ambiente a on a.id = coalesce(cu.ambiente_id, m.ambiente_id)
    join gesnoc.usuario u on u.id = p.tomado_por
    where c.fecha = ${fecha}`);
  return filas.map(({ estacion_id, ...fila }) => ({ ...fila, estacionId: estacion_id }));
}

/** Las líneas de esas comandas, anuladas incluidas: se ven tachadas. */
export async function lineasDeLaNoche(fecha: string): Promise<FilaLineaHistorial[]> {
  const filas = await db().execute<{
    pedido: number;
    estacion_id: number;
    linea: number;
    producto: string;
    cantidad: number;
    nota: string | null;
    anulada: boolean;
  }>(sql`
    select d.pedido_numero as pedido, d.estacion_id, d.linea, pr.nombre as producto, d.cantidad,
           d.nota, d.anulado_en is not null as anulada
    from gesnoc.detalle_pedido d
    join gesnoc.producto pr on pr.id = d.producto_id
    where d.fecha = ${fecha}`);
  return filas.map(({ estacion_id, ...fila }) => ({ ...fila, estacionId: estacion_id }));
}
