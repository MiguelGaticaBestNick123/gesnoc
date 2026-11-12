import 'server-only';
import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';
import { sesion, usuario } from '@/shared/db/esquema/schema';
import { HORAS_DE_SESION } from '@/shared/sesion/actor';

const INTENTOS_PERMITIDOS = 5;
const MINUTOS_DE_BLOQUEO = 15;

const estaBloqueado = sql<boolean>`coalesce(${usuario.bloqueadoHasta} > now(), false)`;

export async function buscarParaIngreso(correo: string) {
  const [fila] = await db()
    .select({
      id: usuario.id,
      claveHash: usuario.claveHash,
      activo: usuario.activo,
      bloqueado: estaBloqueado,
    })
    .from(usuario)
    .where(eq(usuario.correo, correo));
  return fila;
}

// Una sola sentencia: dos intentos simultáneos no pueden contarse como uno.
export async function registrarIntentoFallido(id: number): Promise<boolean> {
  const siguiente = sql`${usuario.intentosFallidos} + 1`;
  const [fila] = await db()
    .update(usuario)
    .set({
      intentosFallidos: sql`case when ${siguiente} >= ${INTENTOS_PERMITIDOS} then 0 else ${siguiente} end`,
      bloqueadoHasta: sql`case when ${siguiente} >= ${INTENTOS_PERMITIDOS}
        then now() + make_interval(mins => ${MINUTOS_DE_BLOQUEO}) else ${usuario.bloqueadoHasta} end`,
    })
    .where(eq(usuario.id, id))
    .returning({ bloqueado: estaBloqueado });
  return fila?.bloqueado ?? false;
}

export async function abrirSesion(usuarioId: number, tokenHash: Buffer) {
  await db().transaction(async (tx) => {
    await tx
      .update(usuario)
      .set({ intentosFallidos: 0, bloqueadoHasta: null })
      .where(eq(usuario.id, usuarioId));
    await tx
      .delete(sesion)
      .where(and(eq(sesion.usuarioId, usuarioId), lte(sesion.expiraEn, sql`now()`)));
    await tx.insert(sesion).values({
      tokenHash,
      usuarioId,
      expiraEn: sql`now() + make_interval(hours => ${HORAS_DE_SESION})`,
    });
  });
}

export const eliminarSesion = (tokenHash: Buffer) =>
  db().delete(sesion).where(eq(sesion.tokenHash, tokenHash));

export const listarPersonal = () =>
  db()
    .select({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      esAdministrador: usuario.esAdministrador,
      activo: usuario.activo,
      bloqueado: estaBloqueado,
    })
    .from(usuario)
    .orderBy(usuario.nombre);

export type Persona = Awaited<ReturnType<typeof listarPersonal>>[number];

export const insertarPersona = (datos: {
  nombre: string;
  correo: string;
  claveHash: string;
  esAdministrador: boolean;
}) => db().insert(usuario).values(datos);

export const actualizarPersona = (
  id: number,
  datos: { nombre: string; correo: string; esAdministrador: boolean },
) => db().update(usuario).set(datos).where(eq(usuario.id, id));

// Cambiar la contraseña expulsa de los teléfonos que tenían la anterior y levanta el bloqueo.
export async function reemplazarClave(id: number, claveHash: string) {
  await db().transaction(async (tx) => {
    await tx
      .update(usuario)
      .set({ claveHash, intentosFallidos: 0, bloqueadoHasta: null })
      .where(eq(usuario.id, id));
    await tx.delete(sesion).where(eq(sesion.usuarioId, id));
  });
}

export async function fijarActivo(id: number, activo: boolean) {
  await db().transaction(async (tx) => {
    await tx.update(usuario).set({ activo }).where(eq(usuario.id, id));
    if (!activo) await tx.delete(sesion).where(eq(sesion.usuarioId, id));
  });
}
