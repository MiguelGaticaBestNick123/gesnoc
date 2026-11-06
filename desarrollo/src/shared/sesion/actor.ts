import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Actor, RolTurno } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { asignacion, noche, sesion, usuario } from '@/shared/db/esquema/schema';

export const nuevoToken = () => randomBytes(32).toString('base64url');

// En la base solo queda el SHA-256 del token: si se filtra, los tokens no sirven.
export const hashDeToken = (token: string) => createHash('sha256').update(token).digest();

// Se consulta en cada petición para que cerrar sesión o desactivar una cuenta rija de inmediato.
export async function actorDeToken(token: string): Promise<Actor | null> {
  const [fila] = await db()
    .select({
      id: usuario.id,
      nombre: usuario.nombre,
      esAdministrador: usuario.esAdministrador,
      fecha: asignacion.fecha,
      rol: asignacion.rol,
      ambienteId: asignacion.ambienteId,
    })
    .from(sesion)
    .innerJoin(usuario, eq(usuario.id, sesion.usuarioId))
    .leftJoin(noche, and(isNotNull(noche.abiertaEn), isNull(noche.cerradaEn)))
    .leftJoin(
      asignacion,
      and(eq(asignacion.fecha, noche.fecha), eq(asignacion.usuarioId, usuario.id)),
    )
    .where(
      and(
        eq(sesion.tokenHash, hashDeToken(token)),
        gt(sesion.expiraEn, sql`now()`),
        eq(usuario.activo, true),
      ),
    );
  if (!fila) return null;

  const { id, nombre, esAdministrador, fecha, rol, ambienteId } = fila;
  const turno = fecha && rol ? { fecha, rol: rol as RolTurno, ambienteId } : null;
  return { id, nombre, esAdministrador, turno };
}
