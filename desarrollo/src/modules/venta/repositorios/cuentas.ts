import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { bloquearCorrelativo, db, type Transaccion } from '@/shared/db/cliente';
import { ambiente, cuenta, mesa, usuario } from '@/shared/db/esquema/schema';
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

/** Mesas activas del ambiente con su cuenta abierta en la noche, si tienen: ocupada se deduce. */
export const mesasDe = (fecha: string | undefined, ambienteId: number) =>
  db()
    .select({
      id: mesa.id,
      numero: mesa.numero,
      forma: mesa.forma,
      posX: mesa.posX,
      posY: mesa.posY,
      ancho: mesa.ancho,
      alto: mesa.alto,
      rotacion: mesa.rotacion,
      cuenta: cuenta.numero,
      abiertaEn: cuenta.abiertaEn,
      garzon: usuario.nombre,
    })
    .from(mesa)
    .leftJoin(
      cuenta,
      and(
        eq(cuenta.mesaId, mesa.id),
        fecha ? eq(cuenta.fecha, fecha) : sql`false`,
        isNull(cuenta.cerradaEn),
      ),
    )
    .leftJoin(usuario, eq(usuario.id, cuenta.abiertaPor))
    .where(and(eq(mesa.ambienteId, ambienteId), eq(mesa.activa, true)))
    .orderBy(asc(mesa.numero));

export const cuentasDePie = (fecha: string, ambienteId: number) =>
  db()
    .select({
      numero: cuenta.numero,
      referencia: cuenta.referencia,
      abiertaEn: cuenta.abiertaEn,
      garzon: usuario.nombre,
    })
    .from(cuenta)
    .innerJoin(usuario, eq(usuario.id, cuenta.abiertaPor))
    .where(
      and(eq(cuenta.fecha, fecha), eq(cuenta.ambienteId, ambienteId), isNull(cuenta.cerradaEn)),
    )
    .orderBy(asc(cuenta.numero));

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

/** Consumo vigente (sin anulados) y cantidad de pagos de una cuenta. */
export async function consumoYPagos(tx: Transaccion, fecha: string, numero: number) {
  const [fila] = await tx.execute<{ consumo: number; pagos: number }>(sql`
    select
      coalesce((select sum(d.cantidad * d.precio_unitario)::int
                from gesnoc.detalle_pedido d
                join gesnoc.pedido p on p.fecha = d.fecha and p.numero = d.pedido_numero
                where p.fecha = ${fecha} and p.cuenta_numero = ${numero}
                  and d.anulado_en is null), 0) as consumo,
      (select count(*)::int from gesnoc.pago
       where fecha = ${fecha} and cuenta_numero = ${numero}) as pagos`);
  return fila ?? { consumo: 0, pagos: 0 };
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
