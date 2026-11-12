import 'server-only';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db, type Transaccion } from '@/shared/db/cliente';
import { arqueo, asignacion, disponibilidad, noche } from '@/shared/db/esquema/schema';
import type { DatosNoche } from '../esquemas';

const cuentaDe = (tabla: typeof disponibilidad | typeof asignacion) =>
  db().$count(tabla, eq(tabla.fecha, noche.fecha));

export const listarNoches = () =>
  db()
    .select({
      fecha: noche.fecha,
      nota: noche.nota,
      precioEntrada: noche.precioEntrada,
      abiertaEn: noche.abiertaEn,
      cerradaEn: noche.cerradaEn,
      disponibles: cuentaDe(disponibilidad),
      asignados: cuentaDe(asignacion),
    })
    .from(noche)
    .orderBy(asc(noche.fecha));

export type Noche = Awaited<ReturnType<typeof listarNoches>>[number];

export async function buscarNoche(fecha: string) {
  const [fila] = await db().select().from(noche).where(eq(noche.fecha, fecha));
  return fila;
}

export const insertarNoche = (datos: DatosNoche) => db().insert(noche).values(datos);

export const actualizarNoche = ({ fecha, ...datos }: DatosNoche) =>
  db().update(noche).set(datos).where(eq(noche.fecha, fecha));

// La disponibilidad y los turnos caen con la noche; una noche abierta ya tiene operaciones.
export const eliminarNocheSinAbrir = (fecha: string) =>
  db()
    .delete(noche)
    .where(and(eq(noche.fecha, fecha), isNull(noche.abiertaEn)))
    .returning({ fecha: noche.fecha });

export async function nocheAbierta() {
  const [fila] = await db()
    .select({
      fecha: noche.fecha,
      nota: noche.nota,
      precioEntrada: noche.precioEntrada,
      fondoInicial: arqueo.fondoInicial,
      asignados: cuentaDe(asignacion),
    })
    .from(noche)
    .innerJoin(arqueo, eq(arqueo.fecha, noche.fecha))
    .where(and(isNotNull(noche.abiertaEn), isNull(noche.cerradaEn)));
  return fila;
}

export async function abrirNoche(fecha: string, fondoInicial: number): Promise<boolean> {
  return db().transaction(async (tx) => {
    const abiertas = await tx
      .update(noche)
      .set({ abiertaEn: sql`now()` })
      .where(and(eq(noche.fecha, fecha), isNull(noche.abiertaEn)))
      .returning({ fecha: noche.fecha });
    if (abiertas.length === 0) return false;
    await tx.insert(arqueo).values({ fecha, fondoInicial });
    return true;
  });
}

/**
 * Bloqueo compartido de la noche abierta hasta el fin de la transacción. `for key share` solo choca
 * con el `for update` del cierre: mientras una operación lo tiene, el cierre espera; si el cierre ya
 * lo tomó, la operación espera y, al terminar el cierre, la noche ya no cumple el filtro.
 */
export async function bloquearNocheAbierta(tx: Transaccion): Promise<string | undefined> {
  const [fila] = await tx.execute<{ fecha: string }>(sql`
    select fecha::text as fecha from gesnoc.noche
    where abierta_en is not null and cerrada_en is null
    for key share`);
  return fila?.fecha;
}

/** Fecha operativa de la noche abierta, si la hay: las operaciones de la noche cuelgan de ella. */
export async function fechaAbierta(): Promise<string | undefined> {
  const [fila] = await db()
    .select({ fecha: noche.fecha })
    .from(noche)
    .where(and(isNotNull(noche.abiertaEn), isNull(noche.cerradaEn)));
  return fila?.fecha;
}

export type EstadoNoche = 'programada' | 'abierta' | 'cerrada';

const estadoSql = sql<EstadoNoche>`case when ${noche.cerradaEn} is not null then 'cerrada'
  when ${noche.abiertaEn} is not null then 'abierta' else 'programada' end`;

/** Noches del rango con su estado, para el calendario. */
export const nochesDelRango = (desde: string, hasta: string) =>
  db()
    .select({
      fecha: noche.fecha,
      nota: noche.nota,
      precioEntrada: noche.precioEntrada,
      estado: estadoSql,
    })
    .from(noche)
    .where(sql`${noche.fecha} between ${desde} and ${hasta}`)
    .orderBy(asc(noche.fecha));

/** Quién tiene turno cada noche del rango, con su rol y ambiente. */
export async function turnosDelRango(desde: string, hasta: string) {
  const filas = await db().execute<{
    fecha: string;
    usuario_id: number;
    nombre: string;
    rol: string;
    ambiente: string | null;
  }>(sql`
    select a.fecha::text as fecha, u.id as usuario_id, u.nombre, a.rol, amb.nombre as ambiente
    from gesnoc.asignacion a
    join gesnoc.usuario u on u.id = a.usuario_id
    left join gesnoc.ambiente amb on amb.id = a.ambiente_id
    where a.fecha between ${desde} and ${hasta}
    order by a.fecha, a.rol, amb.nombre, u.nombre`);
  return filas.map((f) => ({
    fecha: f.fecha,
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    rol: f.rol,
    ambiente: f.ambiente,
  }));
}

/** Quién postuló (declaró disponibilidad) a cada noche del rango. */
export async function postulantesDelRango(desde: string, hasta: string) {
  const filas = await db().execute<{ fecha: string; usuario_id: number; nombre: string }>(sql`
    select d.fecha::text as fecha, u.id as usuario_id, u.nombre
    from gesnoc.disponibilidad d
    join gesnoc.usuario u on u.id = d.usuario_id
    where d.fecha between ${desde} and ${hasta}
    order by d.fecha, u.nombre`);
  return filas.map((f) => ({ fecha: f.fecha, usuarioId: f.usuario_id, nombre: f.nombre }));
}

/** Precio de entrada de la última noche programada: el que se propone para una nueva. */
export async function ultimoPrecio(): Promise<number> {
  const [fila] = await db()
    .select({ precio: noche.precioEntrada })
    .from(noche)
    .orderBy(sql`${noche.fecha} desc`)
    .limit(1);
  return fila?.precio ?? 0;
}
