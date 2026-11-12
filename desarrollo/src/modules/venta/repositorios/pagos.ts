import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db, type Conexion, type Transaccion } from '@/shared/db/cliente';
import { pago } from '@/shared/db/esquema/schema';
import type { MedioDePago } from '../cuenta';

/** El pago que ya se registró con esta clave de envío (RN-13). */
export async function pagoPorClave(conexion: Conexion, claveEnvio: string) {
  const [fila] = await conexion
    .select({
      fecha: pago.fecha,
      cuenta: pago.cuentaNumero,
      numero: pago.numero,
      medio: pago.medio,
      monto: pago.monto,
      propina: pago.propina,
      registradoPor: pago.registradoPor,
    })
    .from(pago)
    .where(eq(pago.claveEnvio, claveEnvio));
  return fila && { ...fila, medio: fila.medio as MedioDePago };
}

/** Siguiente número de pago de la cuenta. Quien lo pide ya tiene la cuenta bloqueada. */
export async function siguientePago(tx: Transaccion, fecha: string, cuenta: number) {
  const [ultimo] = await tx
    .select({ numero: sql<number>`coalesce(max(${pago.numero}), 0)::int` })
    .from(pago)
    .where(and(eq(pago.fecha, fecha), eq(pago.cuentaNumero, cuenta)));
  return (ultimo?.numero ?? 0) + 1;
}

export const insertarPago = (
  tx: Transaccion,
  datos: {
    fecha: string;
    cuentaNumero: number;
    numero: number;
    medio: MedioDePago;
    monto: number;
    propina: number;
    registradoPor: number;
    claveEnvio: string;
  },
) => tx.insert(pago).values(datos);

export interface EfectivoPorEntregar {
  cuenta: number;
  /** «Mesa 4» o la referencia del cliente de pie. */
  ubicacion: string;
  numero: number;
  monto: number;
  propina: number;
  registradoEn: string;
}

/**
 * Pagos en efectivo que cobró la persona en la noche y que la administración aún no confirma
 * (RN-17). Usa el índice parcial `pago_efectivo_pendiente_ix`.
 */
export async function efectivoPorEntregar(
  fecha: string,
  usuarioId: number,
): Promise<EfectivoPorEntregar[]> {
  const filas = await db().execute<{
    cuenta: number;
    mesa: number | null;
    referencia: string | null;
    numero: number;
    monto: number;
    propina: number;
    registrado_en: string;
  }>(sql`
    select p.cuenta_numero as cuenta, m.numero as mesa, c.referencia, p.numero, p.monto,
           p.propina, p.registrado_en::text
    from gesnoc.pago p
    join gesnoc.cuenta c on c.fecha = p.fecha and c.numero = p.cuenta_numero
    left join gesnoc.mesa m on m.id = c.mesa_id
    where p.fecha = ${fecha} and p.medio = 'efectivo' and p.confirmado_en is null
      and p.registrado_por = ${usuarioId}
    order by p.registrado_en, p.cuenta_numero, p.numero`);
  return filas.map((f) => ({
    cuenta: f.cuenta,
    ubicacion: f.mesa === null ? (f.referencia ?? 'Sin mesa') : `Mesa ${f.mesa}`,
    numero: f.numero,
    monto: f.monto,
    propina: f.propina,
    registradoEn: f.registrado_en,
  }));
}
