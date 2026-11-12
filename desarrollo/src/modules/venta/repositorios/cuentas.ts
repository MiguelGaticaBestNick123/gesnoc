import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { bloquearCorrelativo, db, type Transaccion } from '@/shared/db/cliente';
import { ambiente, cuenta, mesa } from '@/shared/db/esquema/schema';
import type { FilaDetalle, PagoDeCuenta } from '../cuenta';
import type { UbicacionCuenta } from '../esquemas';

/** Ambiente de una cuenta: el de su mesa o, si el cliente está de pie, el suyo propio. */
const ambienteDeCuenta = sql<number>`coalesce(${cuenta.ambienteId}, ${mesa.ambienteId})`;

export const ambientesActivos = () =>
  db()
    .select({
      id: ambiente.id,
      nombre: ambiente.nombre,
      planoAncho: ambiente.planoAncho,
      planoAlto: ambiente.planoAlto,
    })
    .from(ambiente)
    .where(eq(ambiente.activo, true))
    .orderBy(asc(ambiente.nombre));

export async function buscarMesa(id: number) {
  const [fila] = await db()
    .select({ ambienteId: mesa.ambienteId, activa: mesa.activa })
    .from(mesa)
    .where(eq(mesa.id, id));
  return fila;
}

// Lo que el mapa muestra de cada cuenta abierta: total vigente, comandas listas sin entregar y la
// espera más larga de lo que aún se prepara. Se calcula al consultar; nada de esto se guarda.
const resumenDeCuenta = sql`
  left join lateral (
    select coalesce(sum(d.cantidad * d.precio_unitario), 0)::int as total
    from gesnoc.pedido p
    join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
    where p.fecha = c.fecha and p.cuenta_numero = c.numero and d.anulado_en is null
  ) t on true
  left join lateral (
    select count(*) filter (where co.lista_en is not null)::int as listas,
           coalesce(max(extract(epoch from now() - p.enviado_en))
                    filter (where co.lista_en is null), 0)::int as espera_maxima
    from gesnoc.pedido p
    join gesnoc.comanda co on co.fecha = p.fecha and co.pedido_numero = p.numero
    where p.fecha = c.fecha and p.cuenta_numero = c.numero and co.entregada_en is null
  ) k on true
  left join lateral (
    select coalesce(sum(pg.monto), 0)::int as pagado
    from gesnoc.pago pg
    where pg.fecha = c.fecha and pg.cuenta_numero = c.numero
  ) g on true`;

type FilaResumen = {
  cuenta: number | null;
  abierta_en: string | null;
  abierta_hace: number | null;
  garzon: string | null;
  total: number | null;
  pagado: number | null;
  listas: number | null;
  espera_maxima: number | null;
};

const resumen = (f: FilaResumen) => ({
  cuenta: f.cuenta,
  abiertaEn: f.abierta_en,
  /** Segundos desde que se abrió, con el reloj del servidor. */
  abiertaHace: f.abierta_hace,
  garzon: f.garzon,
  total: f.total ?? 0,
  /** Lo abonado: el saldo es total menos pagado (la propina no cuenta). */
  pagado: f.pagado ?? 0,
  /** Comandas listas sin entregar: la mesa se pinta verde. */
  listas: f.listas ?? 0,
  /** Segundos que lleva esperando lo más antiguo que aún se prepara. */
  esperaMaxima: f.espera_maxima ?? 0,
});

/** Mesas activas del ambiente con su cuenta abierta en la noche, si tienen: ocupada se deduce. */
export async function mesasDe(fecha: string | undefined, ambienteId: number) {
  const filas = await db().execute<
    FilaResumen & {
      id: number;
      numero: number;
      forma: 'cuadrada' | 'redonda' | 'rectangular';
      pos_x: number;
      pos_y: number;
      ancho: number;
      alto: number;
      rotacion: number;
      sillas: number | null;
    }
  >(sql`
    select m.id, m.numero, m.forma, m.pos_x, m.pos_y, m.ancho, m.alto, m.rotacion, m.sillas,
           c.numero as cuenta, c.abierta_en::text,
           extract(epoch from now() - c.abierta_en)::int as abierta_hace,
           u.nombre as garzon, t.total, g.pagado, k.listas, k.espera_maxima
    from gesnoc.mesa m
    left join gesnoc.cuenta c
      on c.mesa_id = m.id and c.fecha = ${fecha ?? null}::date and c.cerrada_en is null
    left join gesnoc.usuario u on u.id = c.abierta_por
    ${resumenDeCuenta}
    where m.ambiente_id = ${ambienteId} and m.activa
    order by m.numero`);
  return filas.map((f) => ({
    id: f.id,
    numero: f.numero,
    forma: f.forma,
    posX: f.pos_x,
    posY: f.pos_y,
    ancho: f.ancho,
    alto: f.alto,
    rotacion: f.rotacion,
    sillas: f.sillas,
    ...resumen(f),
  }));
}

export async function cuentasDePie(fecha: string, ambienteId: number) {
  const filas = await db().execute<FilaResumen & { referencia: string }>(sql`
    select c.numero as cuenta, c.referencia, c.abierta_en::text,
           extract(epoch from now() - c.abierta_en)::int as abierta_hace,
           u.nombre as garzon, t.total, g.pagado, k.listas, k.espera_maxima
    from gesnoc.cuenta c
    join gesnoc.usuario u on u.id = c.abierta_por
    ${resumenDeCuenta}
    where c.fecha = ${fecha} and c.ambiente_id = ${ambienteId} and c.cerrada_en is null
    order by c.numero`);
  return filas.map((f) => ({ numero: f.cuenta!, referencia: f.referencia, ...resumen(f) }));
}

/**
 * Abre una cuenta con el siguiente número de la noche. Si la mesa ya tiene una cuenta abierta, la
 * devuelve en vez de abrir otra (RN-06): dos garzones que tocan la misma mesa llegan a la misma.
 */
export async function abrirCuenta(
  tx: Transaccion,
  fecha: string,
  abiertaPor: number,
  ubicacion: UbicacionCuenta,
) {
  await bloquearCorrelativo(tx, 'cuenta', fecha);
  if ('mesaId' in ubicacion) {
    const [abierta] = await tx
      .select({ numero: cuenta.numero })
      .from(cuenta)
      .where(
        and(eq(cuenta.fecha, fecha), eq(cuenta.mesaId, ubicacion.mesaId), isNull(cuenta.cerradaEn)),
      );
    if (abierta) return { numero: abierta.numero, existente: true };
  }
  const [ultima] = await tx
    .select({ numero: sql<number>`coalesce(max(${cuenta.numero}), 0)::int` })
    .from(cuenta)
    .where(eq(cuenta.fecha, fecha));
  const numero = (ultima?.numero ?? 0) + 1;
  await tx.insert(cuenta).values({ fecha, numero, abiertaPor, ...ubicacion });
  return { numero, existente: false };
}

/**
 * La mesa sigue activa: se bloquea en modo compartido para que el editor del plano (que la bloquea en
 * exclusivo al guardar) no la retire mientras se le abre una cuenta.
 */
export async function mesaActiva(tx: Transaccion, id: number): Promise<boolean> {
  const [fila] = await tx.execute<{ activa: boolean }>(sql`
    select activa from gesnoc.mesa where id = ${id} for share`);
  return fila?.activa ?? false;
}

/** Lo que muestra la pantalla de una cuenta. */
export async function encabezadoCuenta(fecha: string, numero: number) {
  const [fila] = await db()
    .select({
      numero: cuenta.numero,
      mesa: mesa.numero,
      referencia: cuenta.referencia,
      ambienteId: ambienteDeCuenta,
      ambiente: ambiente.nombre,
      abiertaEn: cuenta.abiertaEn,
      cerradaEn: cuenta.cerradaEn,
    })
    .from(cuenta)
    .leftJoin(mesa, eq(mesa.id, cuenta.mesaId))
    .innerJoin(ambiente, eq(ambiente.id, ambienteDeCuenta))
    .where(and(eq(cuenta.fecha, fecha), eq(cuenta.numero, numero)));
  return fila;
}

export type EncabezadoCuenta = NonNullable<Awaited<ReturnType<typeof encabezadoCuenta>>>;

/**
 * Bloquea la fila de la cuenta hasta el fin de la transacción. Pedir, anular, cobrar y cerrar pasan
 * por aquí, así que nunca corren a la vez sobre la misma cuenta (RN-15, RN-18).
 */
export async function bloquearCuenta(tx: Transaccion, fecha: string, numero: number) {
  // SQL escrito a mano: Drizzle genera «for update of "gesnoc"."cuenta"» y PostgreSQL exige el nombre
  // sin esquema. Se bloquea solo la cuenta, no la mesa.
  const [fila] = await tx.execute<{ cerrada: boolean; ambiente_id: number }>(sql`
    select c.cerrada_en is not null as cerrada, coalesce(c.ambiente_id, m.ambiente_id) as ambiente_id
    from gesnoc.cuenta c
    left join gesnoc.mesa m on m.id = c.mesa_id
    where c.fecha = ${fecha} and c.numero = ${numero}
    for update of c`);
  return fila && { cerrada: fila.cerrada, ambienteId: fila.ambiente_id };
}

/**
 * Consumo vigente (sin anulados), cantidad de pagos y lo pagado de una cuenta. El saldo es consumo
 * menos pagado: la propina no descuenta (ADR-011).
 */
export async function consumoYPagos(tx: Transaccion, fecha: string, numero: number) {
  const [fila] = await tx.execute<{ consumo: number; pagos: number; pagado: number }>(sql`
    select
      coalesce((select sum(d.cantidad * d.precio_unitario)::int
                from gesnoc.detalle_pedido d
                join gesnoc.pedido p on p.fecha = d.fecha and p.numero = d.pedido_numero
                where p.fecha = ${fecha} and p.cuenta_numero = ${numero}
                  and d.anulado_en is null), 0) as consumo,
      g.pagos, g.pagado
    from (select count(*)::int as pagos, coalesce(sum(monto), 0)::int as pagado
          from gesnoc.pago where fecha = ${fecha} and cuenta_numero = ${numero}) g`);
  return fila ?? { consumo: 0, pagos: 0, pagado: 0 };
}

export const cerrarCuenta = (tx: Transaccion, fecha: string, numero: number, cerradaPor: number) =>
  tx
    .update(cuenta)
    .set({ cerradaPor, cerradaEn: sql`now()` })
    .where(and(eq(cuenta.fecha, fecha), eq(cuenta.numero, numero), isNull(cuenta.cerradaEn)));

/** HU-23: todas las líneas de la cuenta, con el estado de su comanda y quién anuló cada una. */
export async function lineasDeCuenta(fecha: string, numero: number): Promise<FilaDetalle[]> {
  const filas = await db().execute<{
    pedido: number;
    enviado_en: string;
    tomado_por: string;
    linea: number;
    producto: string;
    cantidad: number;
    precio_unitario: number;
    nota: string | null;
    estacion: string;
    lista: boolean;
    entregada: boolean;
    anulado_en: string | null;
    anulado_por: string | null;
  }>(sql`
    select p.numero as pedido, p.enviado_en::text, u.nombre as tomado_por, d.linea,
           pr.nombre as producto, d.cantidad, d.precio_unitario, d.nota, e.nombre as estacion,
           c.lista_en is not null as lista, c.entregada_en is not null as entregada,
           d.anulado_en::text, ua.nombre as anulado_por
    from gesnoc.pedido p
    join gesnoc.usuario u on u.id = p.tomado_por
    join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
    join gesnoc.producto pr on pr.id = d.producto_id
    join gesnoc.comanda c
      on c.fecha = d.fecha and c.pedido_numero = d.pedido_numero and c.estacion_id = d.estacion_id
    join gesnoc.estacion e on e.id = d.estacion_id
    left join gesnoc.usuario ua on ua.id = d.anulado_por
    where p.fecha = ${fecha} and p.cuenta_numero = ${numero}`);
  return filas.map((f) => ({
    pedido: f.pedido,
    enviadoEn: f.enviado_en,
    tomadoPor: f.tomado_por,
    linea: f.linea,
    producto: f.producto,
    cantidad: f.cantidad,
    precioUnitario: f.precio_unitario,
    nota: f.nota,
    estacion: f.estacion,
    lista: f.lista,
    entregada: f.entregada,
    anuladoEn: f.anulado_en,
    anuladoPor: f.anulado_por,
  }));
}

export async function pagosDeCuenta(fecha: string, numero: number): Promise<PagoDeCuenta[]> {
  const filas = await db().execute<{
    numero: number;
    medio: PagoDeCuenta['medio'];
    monto: number;
    propina: number;
    registrado_en: string;
    registrado_por: string;
    confirmado: boolean;
  }>(sql`
    select p.numero, p.medio, p.monto, p.propina, p.registrado_en::text,
           u.nombre as registrado_por, p.confirmado_en is not null as confirmado
    from gesnoc.pago p
    join gesnoc.usuario u on u.id = p.registrado_por
    where p.fecha = ${fecha} and p.cuenta_numero = ${numero}
    order by p.numero`);
  return filas.map((f) => ({
    numero: f.numero,
    medio: f.medio,
    monto: f.monto,
    propina: f.propina,
    registradoEn: f.registrado_en,
    registradoPor: f.registrado_por,
    confirmado: f.confirmado,
  }));
}
