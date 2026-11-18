import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';
import type { Evento } from '../bitacora';

/**
 * Todos los eventos de una noche, del más reciente al más antiguo. No hay tabla de auditoría: cada
 * evento ya guarda su autor y su hora en la fila que lo registró (ADR-011), y aquí solo se juntan.
 */
export async function eventosDeLaNoche(fecha: string): Promise<Evento[]> {
  const filas = await db().execute<{
    tipo: Evento['tipo'];
    marca: string;
    actor: string | null;
    datos: Evento['datos'];
  }>(sql`
    with consumo as (
      select p.cuenta_numero as cuenta, sum(d.cantidad * d.precio_unitario) as total
      from gesnoc.pedido p
      join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
      where p.fecha = ${fecha} and d.anulado_en is null
      group by p.cuenta_numero
    ), pagado as (
      select cuenta_numero as cuenta, sum(monto) as total
      from gesnoc.pago where fecha = ${fecha} group by cuenta_numero
    )
    select e.tipo, e.marca::text as marca, e.actor, e.datos from (
      select 'noche_abierta' as tipo, n.abierta_en as marca, null::text as actor,
             '{}'::jsonb as datos
      from gesnoc.noche n where n.fecha = ${fecha} and n.abierta_en is not null
      union all
      select 'noche_cerrada', n.cerrada_en, null, '{}'::jsonb
      from gesnoc.noche n where n.fecha = ${fecha} and n.cerrada_en is not null
      union all
      select 'cuenta_abierta', c.abierta_en, u.nombre,
             jsonb_build_object('cuenta', c.numero, 'ubicacion',
               coalesce('mesa ' || m.numero || ', ' || am.nombre, c.referencia || ', ' || ad.nombre))
      from gesnoc.cuenta c
      join gesnoc.usuario u on u.id = c.abierta_por
      left join gesnoc.mesa m on m.id = c.mesa_id
      left join gesnoc.ambiente am on am.id = m.ambiente_id
      left join gesnoc.ambiente ad on ad.id = c.ambiente_id
      where c.fecha = ${fecha}
      union all
      select 'cuenta_cerrada', c.cerrada_en, u.nombre,
             jsonb_build_object('cuenta', c.numero,
               'saldo', coalesce(co.total, 0) - coalesce(pa.total, 0))
      from gesnoc.cuenta c
      join gesnoc.usuario u on u.id = c.cerrada_por
      left join consumo co on co.cuenta = c.numero
      left join pagado pa on pa.cuenta = c.numero
      where c.fecha = ${fecha} and c.cerrada_en is not null
      union all
      select 'pedido', p.enviado_en, u.nombre,
             jsonb_build_object('pedido', p.numero, 'cuenta', p.cuenta_numero,
               'total', (select coalesce(sum(d.cantidad * d.precio_unitario), 0)
                         from gesnoc.detalle_pedido d
                         where d.fecha = p.fecha and d.pedido_numero = p.numero),
               'items', (select string_agg(d.cantidad || ' × ' || pr.nombre, ', ' order by d.linea)
                         from gesnoc.detalle_pedido d
                         join gesnoc.producto pr on pr.id = d.producto_id
                         where d.fecha = p.fecha and d.pedido_numero = p.numero))
      from gesnoc.pedido p join gesnoc.usuario u on u.id = p.tomado_por
      where p.fecha = ${fecha}
      union all
      select 'anulacion', d.anulado_en, u.nombre,
             jsonb_build_object('pedido', d.pedido_numero, 'item', d.cantidad || ' × ' || pr.nombre)
      from gesnoc.detalle_pedido d
      join gesnoc.usuario u on u.id = d.anulado_por
      join gesnoc.producto pr on pr.id = d.producto_id
      where d.fecha = ${fecha} and d.anulado_en is not null
      union all
      select 'lista', co.lista_en, null,
             jsonb_build_object('pedido', co.pedido_numero, 'estacion', e.nombre)
      from gesnoc.comanda co join gesnoc.estacion e on e.id = co.estacion_id
      where co.fecha = ${fecha} and co.lista_en is not null
      union all
      select 'entregada', co.entregada_en, null,
             jsonb_build_object('pedido', co.pedido_numero, 'estacion', e.nombre)
      from gesnoc.comanda co join gesnoc.estacion e on e.id = co.estacion_id
      where co.fecha = ${fecha} and co.entregada_en is not null
      union all
      select 'pago', pa.registrado_en, u.nombre,
             jsonb_build_object('cuenta', pa.cuenta_numero, 'monto', pa.monto,
               'propina', pa.propina, 'medio', pa.medio)
      from gesnoc.pago pa join gesnoc.usuario u on u.id = pa.registrado_por
      where pa.fecha = ${fecha}
      union all
      select 'efectivo_confirmado', pa.confirmado_en, u.nombre,
             jsonb_build_object('cuenta', pa.cuenta_numero, 'monto', pa.monto + pa.propina)
      from gesnoc.pago pa join gesnoc.usuario u on u.id = pa.confirmado_por
      where pa.fecha = ${fecha} and pa.confirmado_en is not null
      union all
      select 'entrada', en.registrada_en, u.nombre,
             jsonb_build_object('cliente', cl.nombre || ' ' || cl.apellido,
               'ticket', en.ticket, 'medio', en.medio_pago)
      from gesnoc.entrada en
      join gesnoc.usuario u on u.id = en.registrada_por
      join gesnoc.cliente cl on cl.id = en.cliente_id
      where en.fecha = ${fecha}
      union all
      select 'reporte', r.registrado_en, u.nombre,
             jsonb_build_object('cliente', cl.nombre || ' ' || cl.apellido, 'tipo', r.tipo)
      from gesnoc.reporte r
      join gesnoc.usuario u on u.id = r.registrado_por
      join gesnoc.cliente cl on cl.id = r.cliente_id
      where r.fecha = ${fecha}
      union all
      select 'llamado', l.creado_en, null,
             jsonb_build_object('mesa', m.numero, 'ambiente', a.nombre)
      from gesnoc.llamado l
      join gesnoc.mesa m on m.id = l.mesa_id
      join gesnoc.ambiente a on a.id = m.ambiente_id
      where l.fecha = ${fecha}
      union all
      select 'llamado_atendido', l.atendido_en, u.nombre,
             jsonb_build_object('mesa', m.numero, 'ambiente', a.nombre)
      from gesnoc.llamado l
      join gesnoc.usuario u on u.id = l.atendido_por
      join gesnoc.mesa m on m.id = l.mesa_id
      join gesnoc.ambiente a on a.id = m.ambiente_id
      where l.fecha = ${fecha} and l.atendido_en is not null
      union all
      select 'sorteo', s.realizado_en, u.nombre,
             jsonb_build_object('ambiente', a.nombre, 'ticket', s.ticket_ganador, 'premio', s.premio)
      from gesnoc.sorteo s
      join gesnoc.usuario u on u.id = s.realizado_por
      join gesnoc.ambiente a on a.id = s.ambiente_id
      where s.fecha = ${fecha}
    ) e
    order by e.marca desc`);
  return filas.map((f) => ({
    tipo: f.tipo,
    marca: f.marca,
    actor: f.actor,
    datos: f.datos,
  }));
}
