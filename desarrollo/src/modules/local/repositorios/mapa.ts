import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, type Transaccion } from '@/shared/db/cliente';
import { mesa } from '@/shared/db/esquema/schema';
import type { FormaMesa } from '../geometria';
import type { DatosPlano } from '../esquemas';

const columnas = {
  id: mesa.id,
  numero: mesa.numero,
  forma: sql<FormaMesa>`${mesa.forma}`,
  posX: mesa.posX,
  posY: mesa.posY,
  ancho: mesa.ancho,
  alto: mesa.alto,
  rotacion: mesa.rotacion,
  sillas: mesa.sillas,
};

export const mesasActivas = (ambienteId: number) =>
  db()
    .select(columnas)
    .from(mesa)
    .where(and(eq(mesa.ambienteId, ambienteId), eq(mesa.activa, true)))
    .orderBy(asc(mesa.numero));

/** Mesas del ambiente con una cuenta abierta (de cualquier noche): esas no se pueden retirar. */
export async function conCuentaAbierta(ambienteId: number): Promise<number[]> {
  const filas = await db().execute<{ id: number }>(sql`
    select distinct m.id from gesnoc.mesa m
    join gesnoc.cuenta c on c.mesa_id = m.id and c.cerrada_en is null
    where m.ambiente_id = ${ambienteId}`);
  return filas.map((fila) => fila.id);
}

/** Bloquea el ambiente y sus mesas activas: dos personas no guardan el mismo plano a la vez. */
export async function bloquearPlano(tx: Transaccion, ambienteId: number) {
  const [ambiente] = await tx.execute<{ plano_ancho: number; plano_alto: number }>(sql`
    select plano_ancho, plano_alto from gesnoc.ambiente where id = ${ambienteId} for update`);
  const activas = await tx.execute<{ id: number }>(sql`
    select id from gesnoc.mesa where ambiente_id = ${ambienteId} and activa for update`);
  return (
    ambiente && {
      ancho: ambiente.plano_ancho,
      alto: ambiente.plano_alto,
      activas: activas.map((fila) => fila.id),
    }
  );
}

/** Números de las mesas que tienen una cuenta abierta, entre las indicadas. */
export async function numerosConCuentaAbierta(tx: Transaccion, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const filas = await tx.execute<{ numero: number }>(sql`
    select distinct m.numero from gesnoc.mesa m
    join gesnoc.cuenta c on c.mesa_id = m.id and c.cerrada_en is null
    where m.id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by m.numero`);
  return filas.map((fila) => fila.numero);
}

/**
 * Guarda el plano completo. El índice único de números solo cuenta las mesas activas y no se puede
 * diferir: intercambiar dos números en un solo `update` falla. Por eso las mesas que cambian se
 * desactivan, se actualizan y se reactivan dentro de la misma transacción.
 */
export async function guardarPlano(tx: Transaccion, { ambienteId, mesas, retiradas }: DatosPlano) {
  const existentes = mesas.filter((m) => m.id !== undefined);
  const ids = existentes.map((m) => m.id!);
  const tocadas = [...ids, ...retiradas];
  if (tocadas.length > 0) {
    await tx.update(mesa).set({ activa: false }).where(inArray(mesa.id, tocadas));
  }
  for (const { id, ...datos } of existentes) {
    await tx.update(mesa).set(datos).where(eq(mesa.id, id!));
  }
  const nuevas = mesas.filter((m) => m.id === undefined);
  if (nuevas.length > 0) {
    await tx.insert(mesa).values(
      nuevas.map((datos) => ({
        numero: datos.numero,
        forma: datos.forma,
        posX: datos.posX,
        posY: datos.posY,
        ancho: datos.ancho,
        alto: datos.alto,
        rotacion: datos.rotacion,
        sillas: datos.sillas,
        ambienteId,
        // Código opaco del QR de la mesa (RF-33); se podrá regenerar con HU-07.
        tokenQr: randomBytes(16).toString('base64url'),
      })),
    );
  }
  if (ids.length > 0) {
    await tx.update(mesa).set({ activa: true }).where(inArray(mesa.id, ids));
  }
}
