import 'server-only';
import { eq } from 'drizzle-orm';
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

export const fijarAmbienteActivo = (id: number, activo: boolean) =>
  db().update(ambiente).set({ activo }).where(eq(ambiente.id, id));

export const insertarEstacion = (ambienteId: number, datos: DatosEstacion) =>
  db()
    .insert(estacion)
    .values({ ...datos, ambienteId });

export const actualizarEstacion = (id: number, datos: DatosEstacion) =>
  db().update(estacion).set(datos).where(eq(estacion.id, id));

export const eliminarEstacion = (id: number) => db().delete(estacion).where(eq(estacion.id, id));

export async function nombreDeAmbiente(id: number): Promise<string | undefined> {
  const [fila] = await db()
    .select({ nombre: ambiente.nombre })
    .from(ambiente)
    .where(eq(ambiente.id, id));
  return fila?.nombre;
}
