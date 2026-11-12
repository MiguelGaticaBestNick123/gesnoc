import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { RolTurno } from '@/shared/autorizacion';
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

/** Cuántas veces tuvo cada persona cada rol, sin contar la noche indicada. */
export async function historialDeRoles(salvoFecha: string) {
  const filas = await db().execute<{
    usuario_id: number;
    rol: RolTurno;
    veces: number;
    ultima: string;
  }>(sql`
    select usuario_id, rol, count(*)::int as veces, max(fecha)::text as ultima
    from gesnoc.asignacion
    where fecha <> ${salvoFecha}
    group by usuario_id, rol`);
  return filas.map((f) => ({
    usuarioId: f.usuario_id,
    rol: f.rol,
    veces: f.veces,
    ultima: f.ultima,
  }));
}

/** Las noches del rango con lo que le corresponde a la persona en cada una. */
export async function mesDe(usuarioId: number, desde: string, hasta: string) {
  const filas = await db().execute<{
    fecha: string;
    nota: string | null;
    estado: 'programada' | 'abierta' | 'cerrada';
    disponible: boolean;
    rol: RolTurno | null;
    ambiente: string | null;
  }>(sql`
    select n.fecha::text as fecha, n.nota,
           case when n.cerrada_en is not null then 'cerrada'
                when n.abierta_en is not null then 'abierta' else 'programada' end as estado,
           d.usuario_id is not null as disponible, a.rol, amb.nombre as ambiente
    from gesnoc.noche n
    left join gesnoc.disponibilidad d on d.fecha = n.fecha and d.usuario_id = ${usuarioId}
    left join gesnoc.asignacion a on a.fecha = n.fecha and a.usuario_id = ${usuarioId}
    left join gesnoc.ambiente amb on amb.id = a.ambiente_id
    where n.fecha between ${desde} and ${hasta}
    order by n.fecha`);
  return filas.map((f) => ({ ...f }));
}

/**
 * La trayectoria de cada persona para la pantalla de personal: cuántas noches trabajó en cada rol
 * (solo noches que se abrieron) y cuál es su próximo turno en una noche que aún no se cierra.
 */
export async function trayectoriaDelPersonal() {
  const [roles, proximos] = await Promise.all([
    db().execute<{ usuario_id: number; rol: RolTurno; veces: number; ultima: string }>(sql`
      select a.usuario_id, a.rol, count(*)::int as veces, max(a.fecha)::text as ultima
      from gesnoc.asignacion a
      join gesnoc.noche n on n.fecha = a.fecha and n.abierta_en is not null
      group by a.usuario_id, a.rol`),
    db().execute<{ usuario_id: number; fecha: string; rol: RolTurno; ambiente: string | null }>(sql`
      select distinct on (a.usuario_id) a.usuario_id, a.fecha::text as fecha, a.rol,
             amb.nombre as ambiente
      from gesnoc.asignacion a
      join gesnoc.noche n on n.fecha = a.fecha and n.cerrada_en is null
      left join gesnoc.ambiente amb on amb.id = a.ambiente_id
      order by a.usuario_id, a.fecha`),
  ]);
  return {
    roles: roles.map((f) => ({
      usuarioId: f.usuario_id,
      rol: f.rol,
      veces: f.veces,
      ultima: f.ultima,
    })),
    proximos: proximos.map((f) => ({
      usuarioId: f.usuario_id,
      fecha: f.fecha,
      rol: f.rol,
      ambiente: f.ambiente,
    })),
  };
}
