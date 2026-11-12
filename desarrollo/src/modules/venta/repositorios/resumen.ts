import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';

// Cifras de la noche para la portada de la administración. Todo se deriva de pedidos y pagos al
// consultar: nada se guarda, así que las cifras no se pueden contradecir entre sí (ADR-011).

export async function cifras(fecha: string) {
  const [fila] = await db().execute<{
    vendido: number;
    cobrado: number;
    abiertas: number;
    por_cobrar: number;
    en_preparacion: number;
  }>(sql`
    select
      (select coalesce(sum(d.cantidad * d.precio_unitario), 0)::int
       from gesnoc.detalle_pedido d where d.fecha = ${fecha} and d.anulado_en is null) as vendido,
      (select coalesce(sum(p.monto), 0)::int from gesnoc.pago p where p.fecha = ${fecha}) as cobrado,
      (select count(*)::int from gesnoc.cuenta c
       where c.fecha = ${fecha} and c.cerrada_en is null) as abiertas,
      (select coalesce(sum(t.total - g.pagado), 0)::int
       from gesnoc.cuenta c
       cross join lateral (
         select coalesce(sum(d.cantidad * d.precio_unitario), 0) as total
         from gesnoc.pedido p
         join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
         where p.fecha = c.fecha and p.cuenta_numero = c.numero and d.anulado_en is null) t
       cross join lateral (
         select coalesce(sum(pg.monto), 0) as pagado
         from gesnoc.pago pg where pg.fecha = c.fecha and pg.cuenta_numero = c.numero) g
       where c.fecha = ${fecha} and c.cerrada_en is null) as por_cobrar,
      (select count(*)::int from gesnoc.comanda co
       where co.fecha = ${fecha} and co.lista_en is null and co.entregada_en is null
         and exists (select 1 from gesnoc.detalle_pedido d
                     where d.fecha = co.fecha and d.pedido_numero = co.pedido_numero
                       and d.estacion_id = co.estacion_id and d.anulado_en is null)) as en_preparacion`);
  return {
    vendido: fila?.vendido ?? 0,
    cobrado: fila?.cobrado ?? 0,
    cuentasAbiertas: fila?.abiertas ?? 0,
    porCobrar: fila?.por_cobrar ?? 0,
    enPreparacion: fila?.en_preparacion ?? 0,
  };
}

/** Mesas ocupadas y libres, y lo vendido, de cada ambiente activo. */
export async function porAmbiente(fecha: string | null) {
  const filas = await db().execute<{
    id: number;
    nombre: string;
    mesas: number;
    ocupadas: number;
    vendido: number;
  }>(sql`
    select a.id, a.nombre,
           (select count(*)::int from gesnoc.mesa m where m.ambiente_id = a.id and m.activa) as mesas,
           (select count(*)::int from gesnoc.mesa m
            join gesnoc.cuenta c on c.mesa_id = m.id and c.fecha = ${fecha}::date and c.cerrada_en is null
            where m.ambiente_id = a.id and m.activa) as ocupadas,
           (select coalesce(sum(d.cantidad * d.precio_unitario), 0)::int
            from gesnoc.detalle_pedido d
            join gesnoc.pedido p on p.fecha = d.fecha and p.numero = d.pedido_numero
            join gesnoc.cuenta c on c.fecha = p.fecha and c.numero = p.cuenta_numero
            left join gesnoc.mesa m on m.id = c.mesa_id
            where d.fecha = ${fecha}::date and d.anulado_en is null
              and coalesce(c.ambiente_id, m.ambiente_id) = a.id) as vendido
    from gesnoc.ambiente a
    where a.activo
    order by a.nombre`);
  return filas.map((f) => ({ ...f }));
}

export async function ultimosPedidos(fecha: string) {
  const filas = await db().execute<{
    numero: number;
    enviado_en: string;
    ubicacion: string;
    ambiente: string;
    garzon: string;
    resumen: string | null;
  }>(sql`
    select p.numero, p.enviado_en::text,
           coalesce('Mesa ' || m.numero, c.referencia) as ubicacion,
           a.nombre as ambiente, u.nombre as garzon,
           (select string_agg(d.cantidad || ' × ' || pr.nombre, ', ' order by d.linea)
            from gesnoc.detalle_pedido d
            join gesnoc.producto pr on pr.id = d.producto_id
            where d.fecha = p.fecha and d.pedido_numero = p.numero and d.anulado_en is null) as resumen
    from gesnoc.pedido p
    join gesnoc.cuenta c on c.fecha = p.fecha and c.numero = p.cuenta_numero
    left join gesnoc.mesa m on m.id = c.mesa_id
    join gesnoc.ambiente a on a.id = coalesce(c.ambiente_id, m.ambiente_id)
    join gesnoc.usuario u on u.id = p.tomado_por
    where p.fecha = ${fecha}
    order by p.numero desc
    limit 6`);
  return filas.map((f) => ({
    numero: f.numero,
    enviadoEn: f.enviado_en,
    ubicacion: f.ubicacion,
    ambiente: f.ambiente,
    garzon: f.garzon,
    resumen: f.resumen ?? 'Anulado completo',
  }));
}

export async function masPedidos(fecha: string) {
  const filas = await db().execute<{ producto: string; unidades: number; monto: number }>(sql`
    select pr.nombre as producto, sum(d.cantidad)::int as unidades,
           sum(d.cantidad * d.precio_unitario)::int as monto
    from gesnoc.detalle_pedido d
    join gesnoc.producto pr on pr.id = d.producto_id
    where d.fecha = ${fecha} and d.anulado_en is null
    group by pr.nombre
    order by unidades desc, monto desc
    limit 5`);
  return filas.map((f) => ({ ...f }));
}
