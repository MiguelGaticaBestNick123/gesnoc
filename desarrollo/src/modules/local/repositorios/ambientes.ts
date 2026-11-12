import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';
import { ambiente, estacion } from '@/shared/db/esquema/schema';
import type { DatosAmbiente, DatosEstacion } from '../esquemas';

export const listarAmbientes = () => db().select().from(ambiente).orderBy(ambiente.nombre);

export const listarEstaciones = () => db().select().from(estacion).orderBy(estacion.nombre);

export type Ambiente = Awaited<ReturnType<typeof listarAmbientes>>[number];
export type Estacion = Awaited<ReturnType<typeof listarEstaciones>>[number];

export const insertarAmbiente = (datos: DatosAmbiente) => db().insert(ambiente).values(datos);

export const actualizarAmbiente = (id: number, datos: DatosAmbiente) =>
  db().update(ambiente).set(datos).where(eq(ambiente.id, id));

/** Si el ambiente tiene cuentas abiertas o comandas sin entregar en la noche abierta. */
export async function ocupadoEstaNoche(id: number): Promise<boolean> {
  const [fila] = await db().execute<{ ocupado: boolean }>(sql`
    select exists (
      select 1 from gesnoc.cuenta c
      left join gesnoc.mesa m on m.id = c.mesa_id
      join gesnoc.noche n on n.fecha = c.fecha and n.abierta_en is not null and n.cerrada_en is null
      where c.cerrada_en is null and coalesce(c.ambiente_id, m.ambiente_id) = ${id}
    ) or exists (
      select 1 from gesnoc.comanda co
      join gesnoc.estacion e on e.id = co.estacion_id
      join gesnoc.noche n on n.fecha = co.fecha and n.abierta_en is not null and n.cerrada_en is null
      where co.entregada_en is null and e.ambiente_id = ${id}
    ) as ocupado`);
  return fila?.ocupado ?? false;
}

export const fijarAmbienteActivo = (id: number, activo: boolean) =>
  db().update(ambiente).set({ activo }).where(eq(ambiente.id, id));

export const insertarEstacion = (datos: DatosEstacion) => db().insert(estacion).values(datos);

export const renombrarEstacion = (id: number, nombre: string) =>
  db().update(estacion).set({ nombre }).where(eq(estacion.id, id));

export const eliminarEstacion = (id: number) => db().delete(estacion).where(eq(estacion.id, id));

export async function nombreDeAmbiente(id: number): Promise<string | undefined> {
  const [fila] = await db()
    .select({ nombre: ambiente.nombre })
    .from(ambiente)
    .where(eq(ambiente.id, id));
  return fila?.nombre;
}
