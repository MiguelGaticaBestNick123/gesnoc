import 'server-only';
import { sql } from 'drizzle-orm';
import { db, type Conexion, type Transaccion } from '@/shared/db/cliente';

// La caja de la noche. Nada de esto se guarda: el esperado, los saldos y las propinas se derivan de
// los pagos, las entradas y el arqueo al consultarlos (RN-19, ADR-011).

/**
 * RN-19: esperado = fondo de caja + efectivo confirmado de los pagos, con sus propinas + entradas en
 * efectivo (EF). Una entrada pendiente (PN) no está en la caja: se le paga después a la
 * administración. Es la única función del esperado; la usan el arqueo, el cierre y el resumen.
 */
export async function esperado(conexion: Conexion, fecha: string) {
  const [fila] = await conexion.execute<{
    fondo: number;
    pagos: number;
    propinas: number;
    cantidad_pagos: number;
    entradas: number;
    cantidad_entradas: number;
  }>(sql`
    select
      a.fondo_inicial as fondo,
      coalesce((select sum(p.monto) from gesnoc.pago p
                where p.fecha = a.fecha and p.medio = 'efectivo'
                  and p.confirmado_en is not null), 0)::int as pagos,
      coalesce((select sum(p.propina) from gesnoc.pago p
                where p.fecha = a.fecha and p.medio = 'efectivo'
                  and p.confirmado_en is not null), 0)::int as propinas,
      (select count(*) from gesnoc.pago p
       where p.fecha = a.fecha and p.medio = 'efectivo'
         and p.confirmado_en is not null)::int as cantidad_pagos,
      coalesce((select sum(e.monto) from gesnoc.entrada e
                where e.fecha = a.fecha and e.medio_pago = 'efectivo'), 0)::int as entradas,
      (select count(*) from gesnoc.entrada e
       where e.fecha = a.fecha and e.medio_pago = 'efectivo')::int as cantidad_entradas
    from gesnoc.arqueo a
    where a.fecha = ${fecha}`);
  if (!fila) return null;
  return {
    fondo: fila.fondo,
    pagos: fila.pagos,
    propinas: fila.propinas,
    cantidadPagos: fila.cantidad_pagos,
    entradas: fila.entradas,
    cantidadEntradas: fila.cantidad_entradas,
    total: fila.fondo + fila.pagos + fila.propinas + fila.entradas,
  };
}

export type Esperado = NonNullable<Awaited<ReturnType<typeof esperado>>>;

/** El conteo de la caja: cuánto se contó, quién y la nota, si la hay. */
export async function conteoDe(conexion: Conexion, fecha: string) {
  const [fila] = await conexion.execute<{
    contado: number | null;
    nota: string | null;
    contado_por: string | null;
  }>(sql`
    select a.efectivo_contado as contado, a.nota, u.nombre as contado_por
    from gesnoc.arqueo a
    left join gesnoc.usuario u on u.id = a.contado_por
    where a.fecha = ${fecha}`);
  return fila && { contado: fila.contado, nota: fila.nota, contadoPor: fila.contado_por };
}

export const guardarConteo = (
  tx: Transaccion,
  fecha: string,
  contado: number,
  nota: string | null,
  contadoPor: number,
) =>
  tx.execute(sql`
    update gesnoc.arqueo
    set efectivo_contado = ${contado}, nota = ${nota}, contado_por = ${contadoPor}
    where fecha = ${fecha}`);

/**
 * Un conteo de caja vale para el esperado con que se hizo. Si después entra efectivo (se confirma un
 * pago o una entrada EF), el conteo se borra y hay que volver a contar: una nota escrita para una
 * diferencia de $2.000 no puede quedar explicando otra de $62.000.
 */
export const anularConteo = (tx: Transaccion, fecha: string) =>
  tx.execute(sql`
    update gesnoc.arqueo set efectivo_contado = null, nota = null, contado_por = null
    where fecha = ${fecha} and efectivo_contado is not null`);

/** RN-17: el efectivo de los pagos que la administración aún no confirma, de cada garzón. */
export async function efectivoSinConfirmar(fecha: string) {
  const filas = await db().execute<{
    usuario_id: number;
    garzon: string;
    cuenta: number;
    numero: number;
    mesa: number | null;
    referencia: string | null;
    ambiente: string;
    monto: number;
    propina: number;
    registrado_en: string;
  }>(sql`
    select p.registrado_por as usuario_id, u.nombre as garzon, p.cuenta_numero as cuenta, p.numero,
           m.numero as mesa, c.referencia, a.nombre as ambiente, p.monto, p.propina,
           p.registrado_en::text as registrado_en
    from gesnoc.pago p
    join gesnoc.usuario u on u.id = p.registrado_por
    join gesnoc.cuenta c on c.fecha = p.fecha and c.numero = p.cuenta_numero
    left join gesnoc.mesa m on m.id = c.mesa_id
    join gesnoc.ambiente a on a.id = coalesce(c.ambiente_id, m.ambiente_id)
    where p.fecha = ${fecha} and p.medio = 'efectivo' and p.confirmado_en is null
    order by u.nombre, p.registrado_en, p.cuenta_numero, p.numero`);
  return filas.map((f) => ({
    usuarioId: f.usuario_id,
    garzon: f.garzon,
    cuenta: f.cuenta,
    numero: f.numero,
    ubicacion: f.mesa === null ? (f.referencia ?? 'Sin mesa') : `Mesa ${f.mesa}`,
    ambiente: f.ambiente,
    monto: f.monto,
    propina: f.propina,
    registradoEn: f.registrado_en,
  }));
}

/**
 * HU-26: confirma exactamente los pagos que la administración vio en pantalla. Solo efectivo y solo
 * los que siguen sin confirmar: confirmar dos veces no cambia nada, ni siquiera quién lo hizo.
 */
export async function confirmarPagos(
  tx: Transaccion,
  fecha: string,
  pagos: { cuenta: number; numero: number }[],
  confirmadoPor: number,
) {
  if (pagos.length === 0) return [];
  const claves = sql.join(
    pagos.map((p) => sql`(${p.cuenta}::int, ${p.numero}::smallint)`),
    sql`, `,
  );
  const filas = await tx.execute<{
    cuenta: number;
    numero: number;
    monto: number;
    propina: number;
  }>(sql`
    update gesnoc.pago
    set confirmado_por = ${confirmadoPor}, confirmado_en = now()
    where fecha = ${fecha} and medio = 'efectivo' and confirmado_en is null
      and (cuenta_numero, numero) in (${claves})
    returning cuenta_numero as cuenta, numero, monto, propina`);
  return filas.map((f) => ({ ...f }));
}

/** Cuentas abiertas de la noche con su consumo, lo pagado y el saldo, para cerrarlas (HU-27). */
export async function cuentasAbiertas(fecha: string) {
  const filas = await db().execute<{
    numero: number;
    mesa: number | null;
    referencia: string | null;
    ambiente: string;
    garzon: string;
    abierta_en: string;
    consumo: number;
    pagado: number;
  }>(sql`
    select c.numero, m.numero as mesa, c.referencia, a.nombre as ambiente, u.nombre as garzon,
           c.abierta_en::text as abierta_en,
           coalesce((select sum(d.cantidad * d.precio_unitario)
                     from gesnoc.pedido p
                     join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
                     where p.fecha = c.fecha and p.cuenta_numero = c.numero
                       and d.anulado_en is null), 0)::int as consumo,
           coalesce((select sum(pg.monto) from gesnoc.pago pg
                     where pg.fecha = c.fecha and pg.cuenta_numero = c.numero), 0)::int as pagado
    from gesnoc.cuenta c
    left join gesnoc.mesa m on m.id = c.mesa_id
    join gesnoc.ambiente a on a.id = coalesce(c.ambiente_id, m.ambiente_id)
    join gesnoc.usuario u on u.id = c.abierta_por
    where c.fecha = ${fecha} and c.cerrada_en is null
    order by c.numero`);
  return filas.map((f) => ({
    numero: f.numero,
    ubicacion: f.mesa === null ? (f.referencia ?? 'Sin mesa') : `Mesa ${f.mesa}`,
    ambiente: f.ambiente,
    garzon: f.garzon,
    abiertaEn: f.abierta_en,
    consumo: f.consumo,
    pagado: f.pagado,
    saldo: f.consumo - f.pagado,
  }));
}

/** Lo que impide cerrar la noche (RN-20): se cuenta dentro de la transacción del cierre. */
export async function pendientesDelCierre(tx: Transaccion, fecha: string) {
  const [fila] = await tx.execute<{
    cuentas: number;
    efectivo: number;
    sin_contar: boolean;
  }>(sql`
    select
      (select count(*) from gesnoc.cuenta where fecha = ${fecha} and cerrada_en is null)::int
        as cuentas,
      (select count(*) from gesnoc.pago
       where fecha = ${fecha} and medio = 'efectivo' and confirmado_en is null)::int as efectivo,
      coalesce((select efectivo_contado is null from gesnoc.arqueo where fecha = ${fecha}), true)
        as sin_contar`);
  return {
    cuentasAbiertas: fila?.cuentas ?? 0,
    efectivoSinConfirmar: fila?.efectivo ?? 0,
    sinContar: fila?.sin_contar ?? true,
  };
}

/**
 * Bloqueo exclusivo de la noche abierta para cerrarla. Choca con el bloqueo compartido de cada
 * operación (`enLaNoche`): el cierre espera a las que están en curso y las que llegan después
 * esperan al cierre y se rechazan, porque la noche ya no está abierta (RN-26).
 */
export async function bloquearNocheParaCerrar(tx: Transaccion, fecha: string) {
  const [fila] = await tx.execute<{ abierta: boolean }>(sql`
    select abierta_en is not null and cerrada_en is null as abierta
    from gesnoc.noche where fecha = ${fecha}
    for update`);
  return fila?.abierta ?? false;
}

/**
 * RN-25: al cerrar se anonimizan los clientes sin visitas en los 12 meses anteriores a la fecha de la
 * noche (no al reloj): documento «ANON» seguido de su id y nombre «Anónimo», y la descripción de sus
 * reportes. Las invitaciones de esas noches también se borran: ya cumplieron su función y guardan
 * nombre y documento.
 */
export async function anonimizar(tx: Transaccion, fecha: string): Promise<number> {
  const [fila] = await tx.execute<{ anonimizados: number }>(sql`
    with anonimos as (
      update gesnoc.cliente c
      set documento = 'ANON' || c.id, nombre = 'Anónimo', apellido = 'Anónimo'
      where c.documento not like 'ANON%'
        and not exists (select 1 from gesnoc.entrada e
                        where e.cliente_id = c.id
                          and e.fecha > ${fecha}::date - interval '12 months')
      returning c.id
    ), reportes as (
      update gesnoc.reporte set descripcion = 'Anonimizado'
      where cliente_id in (select id from anonimos)
    )
    select count(*)::int as anonimizados from anonimos`);
  await tx.execute(sql`
    delete from gesnoc.invitacion where fecha <= ${fecha}::date - interval '12 months'`);
  return fila?.anonimizados ?? 0;
}

export const marcarCerrada = (tx: Transaccion, fecha: string) =>
  tx.execute(sql`update gesnoc.noche set cerrada_en = now() where fecha = ${fecha}`);

/** Noches que ya se abrieron, para elegir cuál ver en «Ventas y propinas». */
export async function nochesConVentas() {
  const filas = await db().execute<{ fecha: string; cerrada: boolean }>(sql`
    select fecha::text as fecha, cerrada_en is not null as cerrada
    from gesnoc.noche where abierta_en is not null
    order by fecha desc`);
  return filas.map((f) => ({ fecha: f.fecha, cerrada: f.cerrada }));
}

/**
 * HU-29: lo vendido, cobrado y por cobrar de la noche, por ambiente, más lo que se cerró con saldo
 * (HU-27). Se cumple vendido = cobrado + por cobrar + cerrado con saldo, que sirve de control.
 */
export async function ventasPorAmbiente(fecha: string) {
  const filas = await db().execute<{
    ambiente_id: number;
    ambiente: string;
    vendido: number;
    cobrado: number;
    propinas: number;
    por_cobrar: number;
    cerrado_con_saldo: number;
    cuentas: number;
  }>(sql`
    with cuentas as (
      select c.numero, c.cerrada_en, coalesce(c.ambiente_id, m.ambiente_id) as ambiente_id,
             coalesce((select sum(d.cantidad * d.precio_unitario)
                       from gesnoc.pedido p
                       join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
                       where p.fecha = c.fecha and p.cuenta_numero = c.numero
                         and d.anulado_en is null), 0)::int as consumo,
             coalesce((select sum(pg.monto) from gesnoc.pago pg
                       where pg.fecha = c.fecha and pg.cuenta_numero = c.numero), 0)::int as pagado,
             coalesce((select sum(pg.propina) from gesnoc.pago pg
                       where pg.fecha = c.fecha and pg.cuenta_numero = c.numero), 0)::int as propina
      from gesnoc.cuenta c
      left join gesnoc.mesa m on m.id = c.mesa_id
      where c.fecha = ${fecha}
    )
    select a.id as ambiente_id, a.nombre as ambiente,
           coalesce(sum(k.consumo), 0)::int as vendido,
           coalesce(sum(k.pagado), 0)::int as cobrado,
           coalesce(sum(k.propina), 0)::int as propinas,
           coalesce(sum(k.consumo - k.pagado) filter (where k.cerrada_en is null), 0)::int
             as por_cobrar,
           coalesce(sum(k.consumo - k.pagado) filter (where k.cerrada_en is not null), 0)::int
             as cerrado_con_saldo,
           count(k.numero)::int as cuentas
    from gesnoc.ambiente a
    left join cuentas k on k.ambiente_id = a.id
    where a.activo or k.numero is not null
    group by a.id, a.nombre
    order by a.nombre`);
  return filas.map((f) => ({
    ambienteId: f.ambiente_id,
    ambiente: f.ambiente,
    vendido: f.vendido,
    cobrado: f.cobrado,
    propinas: f.propinas,
    porCobrar: f.por_cobrar,
    cerradoConSaldo: f.cerrado_con_saldo,
    cuentas: f.cuentas,
  }));
}

/** Lo cobrado por medio de pago en la noche, sin propinas. */
export async function cobradoPorMedio(fecha: string) {
  const filas = await db().execute<{
    medio: string;
    monto: number;
    propina: number;
    pagos: number;
  }>(sql`
    select medio, sum(monto)::int as monto, sum(propina)::int as propina, count(*)::int as pagos
    from gesnoc.pago where fecha = ${fecha}
    group by medio`);
  return filas.map((f) => ({ ...f }));
}

/**
 * Quién reparte las propinas de cada ambiente (regla del Product Owner, 12 nov): los garzones y
 * barman que esa noche tuvieron turno en él. Cocina y guardia no llevan ambiente y no reciben.
 */
export async function equipoPorAmbiente(fecha: string) {
  const filas = await db().execute<{
    ambiente_id: number;
    usuario_id: number;
    nombre: string;
    rol: string;
  }>(sql`
    select a.ambiente_id, a.usuario_id, u.nombre, a.rol
    from gesnoc.asignacion a
    join gesnoc.usuario u on u.id = a.usuario_id
    where a.fecha = ${fecha} and a.rol in ('garzon', 'barman')
    order by a.rol desc, u.nombre`);
  return filas.map((f) => ({
    ambienteId: f.ambiente_id,
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    rol: f.rol,
  }));
}

/** Las entradas de la noche por forma (EF, RC, PN y gratis), para la administración. */
export async function entradasPorForma(fecha: string) {
  const filas = await db().execute<{ medio: string | null; personas: number; monto: number }>(sql`
    select medio_pago as medio, count(*)::int as personas, coalesce(sum(monto), 0)::int as monto
    from gesnoc.entrada where fecha = ${fecha}
    group by medio_pago`);
  return filas.map((f) => ({ ...f }));
}

/** Entradas pendientes (PN): quién debe su entrada a la administración. */
export async function entradasPendientes(fecha: string) {
  const filas = await db().execute<{
    nombre: string;
    apellido: string;
    documento: string;
    ticket: number;
    monto: number;
    registrada_en: string;
  }>(sql`
    select c.nombre, c.apellido, c.documento, e.ticket, e.monto,
           e.registrada_en::text as registrada_en
    from gesnoc.entrada e
    join gesnoc.cliente c on c.id = e.cliente_id
    where e.fecha = ${fecha} and e.medio_pago = 'pendiente'
    order by e.registrada_en`);
  return filas.map((f) => ({
    nombre: f.nombre,
    apellido: f.apellido,
    documento: f.documento,
    ticket: f.ticket,
    monto: f.monto,
    registradaEn: f.registrada_en,
  }));
}
