import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';

// Las consultas del panel de indicadores. Las horas se agrupan en hora de Chile: la noche se piensa
// en hora local y cruza la medianoche, así que la clave lleva la fecha («2026-11-07T23»).
const horaLocal = (columna: SQL) =>
  sql`to_char(date_trunc('hour', ${columna} at time zone 'America/Santiago'), 'YYYY-MM-DD"T"HH24')`;

/** Lo vendido por hora en que se envió cada pedido, sin los ítems anulados. */
export async function ventasPorHora(fecha: string) {
  const filas = await db().execute<{ hora: string; total: number }>(sql`
    select ${horaLocal(sql`p.enviado_en`)} as hora,
           sum(d.cantidad * d.precio_unitario)::int as total
    from gesnoc.detalle_pedido d
    join gesnoc.pedido p on p.fecha = d.fecha and p.numero = d.pedido_numero
    where d.fecha = ${fecha} and d.anulado_en is null
    group by 1 order by 1`);
  return [...filas];
}

/** Cuántas personas entraron por hora, y cómo entraron (EF, RC, PN o gratis). */
export async function ingresosPorHora(fecha: string) {
  const filas = await db().execute<{ hora: string; total: number }>(sql`
    select ${horaLocal(sql`registrada_en`)} as hora, count(*)::int as total
    from gesnoc.entrada where fecha = ${fecha}
    group by 1 order by 1`);
  return [...filas];
}

export async function ingresosPorMedio(fecha: string) {
  const filas = await db().execute<{ medio: string | null; total: number }>(sql`
    select medio_pago as medio, count(*)::int as total
    from gesnoc.entrada where fecha = ${fecha}
    group by 1`);
  return [...filas];
}

/**
 * Cuánto tardó cada estación desde que el pedido se envió hasta que su comanda quedó lista: la
 * mediana (la espera típica) y el percentil 90 (9 de cada 10 comandas estuvieron antes). La mediana
 * no se deja arrastrar por una comanda olvidada, como pasaría con el promedio.
 */
export async function preparacionPorEstacion(fecha: string) {
  const espera = sql`extract(epoch from c.lista_en - p.enviado_en)`;
  const filas = await db().execute<{
    estacion: string;
    listas: number;
    pendientes: number;
    mediana: number | null;
    p90: number | null;
  }>(sql`
    select e.nombre as estacion,
           count(c.lista_en)::int as listas,
           count(*) filter (where c.lista_en is null)::int as pendientes,
           (percentile_cont(0.5) within group (order by ${espera})
             filter (where c.lista_en is not null))::int as mediana,
           (percentile_cont(0.9) within group (order by ${espera})
             filter (where c.lista_en is not null))::int as p90
    from gesnoc.comanda c
    join gesnoc.pedido p on p.fecha = c.fecha and p.numero = c.pedido_numero
    join gesnoc.estacion e on e.id = c.estacion_id
    where c.fecha = ${fecha}
    group by e.nombre order by e.nombre`);
  return [...filas];
}

/** Los llamados de las mesas: cuántos hubo, cuántos se atendieron y cuánto se esperó. */
export async function llamados(fecha: string) {
  const espera = sql`extract(epoch from atendido_en - creado_en)`;
  const [fila] = await db().execute<{
    total: number;
    atendidos: number;
    mediana: number | null;
    maxima: number | null;
  }>(sql`
    select count(*)::int as total, count(atendido_en)::int as atendidos,
           (percentile_cont(0.5) within group (order by ${espera})
             filter (where atendido_en is not null))::int as mediana,
           max(${espera})::int as maxima
    from gesnoc.llamado where fecha = ${fecha}`);
  return fila!;
}

/** Las cuentas de la noche: cuántas, el consumo promedio y cuánto duró una cuenta típica. */
export async function cuentas(fecha: string) {
  const [fila] = await db().execute<{
    cuentas: number;
    vendido: number;
    ticket_promedio: number;
    duracion_mediana: number | null;
  }>(sql`
    with consumo as (
      select p.cuenta_numero, sum(d.cantidad * d.precio_unitario) as total
      from gesnoc.detalle_pedido d
      join gesnoc.pedido p on p.fecha = d.fecha and p.numero = d.pedido_numero
      where d.fecha = ${fecha} and d.anulado_en is null
      group by p.cuenta_numero
    )
    select (select count(*) from gesnoc.cuenta where fecha = ${fecha})::int as cuentas,
           coalesce((select sum(total) from consumo), 0)::int as vendido,
           coalesce((select round(avg(total)) from consumo), 0)::int as ticket_promedio,
           (select percentile_cont(0.5) within group
                     (order by extract(epoch from cerrada_en - abierta_en))
            from gesnoc.cuenta where fecha = ${fecha} and cerrada_en is not null)::int
             as duracion_mediana`);
  return fila!;
}
