import 'server-only';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';
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

/** Fecha operativa de la noche abierta, si la hay: las operaciones de la noche cuelgan de ella. */
export async function fechaAbierta(): Promise<string | undefined> {
  const [fila] = await db()
    .select({ fecha: noche.fecha })
    .from(noche)
    .where(and(isNotNull(noche.abiertaEn), isNull(noche.cerradaEn)));
  return fila?.fecha;
}
