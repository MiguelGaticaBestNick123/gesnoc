import 'server-only';
import { and, eq, lte, ne, sql } from 'drizzle-orm';
import type { RolTurno } from '@/shared/autorizacion';
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

const intentosAgotados = sql`${usuario.intentosFallidos} >= ${INTENTOS_PERMITIDOS}`;
const bloqueoNuevo = sql`case when ${intentosAgotados}
  then now() + make_interval(mins => ${MINUTOS_DE_BLOQUEO}) else ${usuario.bloqueadoHasta} end`;

/**
 * RNF-02: cada intento se reserva antes de verificar la contraseña, en una sola sentencia. Así, aunque
 * lleguen muchos intentos a la vez, a lo más cinco se verifican; el siguiente bloquea la cuenta 15
 * minutos. Sin la reserva, todos leían «no bloqueada» antes de que se registrara el quinto fallo y
 * cada uno probaba su contraseña. Devuelve si el intento puede verificarse.
 */
export async function reservarIntento(id: number): Promise<boolean> {
  const [fila] = await db()
    .update(usuario)
    .set({
      intentosFallidos: sql`case when ${intentosAgotados} then 0 else ${usuario.intentosFallidos} + 1 end`,
      bloqueadoHasta: bloqueoNuevo,
    })
    .where(and(eq(usuario.id, id), sql`not ${estaBloqueado}`))
    .returning({ bloqueado: estaBloqueado });
  return fila !== undefined && !fila.bloqueado;
}

/** El intento reservado falló: con el quinto, la cuenta se bloquea 15 minutos (HU-01 CA2). */
export async function registrarIntentoFallido(id: number): Promise<boolean> {
  const [fila] = await db()
    .update(usuario)
    .set({
      intentosFallidos: sql`case when ${intentosAgotados} then 0 else ${usuario.intentosFallidos} end`,
      bloqueadoHasta: bloqueoNuevo,
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
      rolHabitual: sql<RolTurno | null>`${usuario.rolHabitual}`,
      rolAlternativo: sql<RolTurno | null>`${usuario.rolAlternativo}`,
    })
    .from(usuario)
    .orderBy(usuario.nombre);

export type Persona = Awaited<ReturnType<typeof listarPersonal>>[number];

interface DatosDeCuenta {
  nombre: string;
  correo: string;
  esAdministrador: boolean;
  rolHabitual: RolTurno | null;
  rolAlternativo: RolTurno | null;
}

export const insertarPersona = (datos: DatosDeCuenta & { claveHash: string }) =>
  db().insert(usuario).values(datos);

export const actualizarPersona = (id: number, datos: DatosDeCuenta) =>
  db().update(usuario).set(datos).where(eq(usuario.id, id));

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

/** La contraseña guardada de una persona activa, para verificar la actual antes de cambiarla. */
export async function claveDe(id: number) {
  const [fila] = await db()
    .select({ claveHash: usuario.claveHash, bloqueado: estaBloqueado })
    .from(usuario)
    .where(and(eq(usuario.id, id), eq(usuario.activo, true)));
  return fila;
}

/**
 * Brecha 5: la persona cambia su propia contraseña. Se cierran sus demás sesiones (una sesión robada
 * no sobrevive al cambio) y se conserva la del teléfono desde el que la cambió.
 */
export async function reemplazarClavePropia(id: number, claveHash: string, tokenHash: Buffer) {
  await db().transaction(async (tx) => {
    await tx
      .update(usuario)
      .set({ claveHash, intentosFallidos: 0, bloqueadoHasta: null })
      .where(eq(usuario.id, id));
    await tx.delete(sesion).where(and(eq(sesion.usuarioId, id), ne(sesion.tokenHash, tokenHash)));
  });
}

export async function fijarActivo(id: number, activo: boolean) {
  await db().transaction(async (tx) => {
    await tx.update(usuario).set({ activo }).where(eq(usuario.id, id));
    if (activo) return;
    await tx.delete(sesion).where(eq(sesion.usuarioId, id));
    // Sus turnos y postulaciones de las noches que aún no se abren dejan de valer: ya no trabaja en
    // el local, y un turno suyo contaría en la dotación y en el reparto de propinas. En la noche
    // abierta y en las cerradas, el turno queda como registro de quién trabajó.
    await tx.execute(sql`
      delete from gesnoc.asignacion a using gesnoc.noche n
      where a.usuario_id = ${id} and n.fecha = a.fecha and n.abierta_en is null`);
    await tx.execute(sql`
      delete from gesnoc.disponibilidad d using gesnoc.noche n
      where d.usuario_id = ${id} and n.fecha = d.fecha and n.abierta_en is null`);
  });
}
