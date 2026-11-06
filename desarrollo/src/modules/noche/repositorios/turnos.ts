import 'server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';
import { ambiente, asignacion, disponibilidad, noche, usuario } from '@/shared/db/esquema/schema';
import type { DatosAsignacion } from '../esquemas';

// Noches que siguen vigentes, con lo que le corresponde a una persona en cada una.
export const turnosDe = (usuarioId: number) =>
  db()
    .select({
      fecha: noche.fecha,
      nota: noche.nota,
      abiertaEn: noche.abiertaEn,
      disponible: disponibilidad.usuarioId,
      rol: asignacion.rol,
      ambiente: ambiente.nombre,
    })
    .from(noche)
    .leftJoin(
      disponibilidad,
      and(eq(disponibilidad.fecha, noche.fecha), eq(disponibilidad.usuarioId, usuarioId)),
    )
    .leftJoin(
      asignacion,
      and(eq(asignacion.fecha, noche.fecha), eq(asignacion.usuarioId, usuarioId)),
    )
    .leftJoin(ambiente, eq(ambiente.id, asignacion.ambienteId))
    .where(isNull(noche.cerradaEn))
    .orderBy(asc(noche.fecha));

export const declararDisponible = (fecha: string, usuarioId: number) =>
  db().insert(disponibilidad).values({ fecha, usuarioId }).onConflictDoNothing();

export const retirarDisponible = (fecha: string, usuarioId: number) =>
  db()
    .delete(disponibilidad)
    .where(and(eq(disponibilidad.fecha, fecha), eq(disponibilidad.usuarioId, usuarioId)));

// Dotación de una noche: todo el personal activo, con su disponibilidad y su turno si lo tiene.
export const dotacionDe = (fecha: string) =>
  db()
    .select({
      id: usuario.id,
      nombre: usuario.nombre,
      disponible: disponibilidad.usuarioId,
      rol: asignacion.rol,
      ambienteId: asignacion.ambienteId,
    })
    .from(usuario)
    .leftJoin(
      disponibilidad,
      and(eq(disponibilidad.fecha, fecha), eq(disponibilidad.usuarioId, usuario.id)),
    )
    .leftJoin(asignacion, and(eq(asignacion.fecha, fecha), eq(asignacion.usuarioId, usuario.id)))
    .where(eq(usuario.activo, true))
    .orderBy(asc(usuario.nombre));

export async function estaDisponible(fecha: string, usuarioId: number): Promise<boolean> {
  const filas = await db()
    .select({ fecha: disponibilidad.fecha })
    .from(disponibilidad)
    .where(and(eq(disponibilidad.fecha, fecha), eq(disponibilidad.usuarioId, usuarioId)));
  return filas.length > 0;
}

// La clave (noche, persona) deja un solo turno por noche: reasignar reemplaza el anterior (RN-04).
export const guardarTurno = ({ fecha, usuarioId, rol, ambienteId }: DatosAsignacion) =>
  db()
    .insert(asignacion)
    .values({ fecha, usuarioId, rol, ambienteId })
    .onConflictDoUpdate({
      target: [asignacion.fecha, asignacion.usuarioId],
      set: { rol, ambienteId },
    });

export const eliminarTurno = (fecha: string, usuarioId: number) =>
  db()
    .delete(asignacion)
    .where(and(eq(asignacion.fecha, fecha), eq(asignacion.usuarioId, usuarioId)));
