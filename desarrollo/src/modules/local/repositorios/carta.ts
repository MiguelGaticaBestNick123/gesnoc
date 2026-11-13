import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, type Conexion } from '@/shared/db/cliente';
import { mesa } from '@/shared/db/esquema/schema';
import { agruparPorCategoria } from '../carta';

/** Código opaco del QR de una mesa (RF-33): 128 bits al azar, imposible de adivinar. */
export const nuevoCodigoDeMesa = () => randomBytes(16).toString('base64url');

/**
 * La mesa activa que abre este código, con su ambiente. Un código regenerado (RN-28), una mesa
 * retirada o un ambiente desactivado ya no encuentran nada.
 */
export async function mesaDelCodigo(conexion: Conexion, codigo: string) {
  const [fila] = await conexion.execute<{
    id: number;
    numero: number;
    ambiente_id: number;
    ambiente: string;
  }>(sql`
    select m.id, m.numero, m.ambiente_id, a.nombre as ambiente
    from gesnoc.mesa m
    join gesnoc.ambiente a on a.id = m.ambiente_id
    where m.token_qr = ${codigo} and m.activa and a.activo`);
  return (
    fila && {
      id: fila.id,
      numero: fila.numero,
      ambienteId: fila.ambiente_id,
      ambiente: fila.ambiente,
    }
  );
}

/** HU-38 CA2: solo los productos activos, agrupados por categoría (en el orden del catálogo). */
export async function catalogoPublico() {
  const filas = await db().execute<{
    categoria_id: number;
    categoria: string;
    id: number;
    nombre: string;
    precio: number;
  }>(sql`
    select c.id as categoria_id, c.nombre as categoria, p.id, p.nombre, p.precio
    from gesnoc.producto p
    join gesnoc.categoria c on c.id = p.categoria_id
    where p.activo
    order by c.nombre, p.nombre`);
  return agruparPorCategoria(
    filas.map((f) => ({
      categoriaId: f.categoria_id,
      categoria: f.categoria,
      id: f.id,
      nombre: f.nombre,
      precio: f.precio,
    })),
  );
}

/** Las mesas activas de un ambiente con su código, para mostrarlo o imprimirlo (HU-07). */
export const codigosDelAmbiente = (ambienteId: number) =>
  db()
    .select({ id: mesa.id, numero: mesa.numero, codigo: mesa.tokenQr })
    .from(mesa)
    .where(and(eq(mesa.ambienteId, ambienteId), eq(mesa.activa, true)))
    .orderBy(mesa.numero);

/** El código de una mesa activa, con el nombre de su ambiente para el archivo descargado. */
export async function codigoDeMesa(mesaId: number) {
  const [fila] = await db().execute<{ numero: number; codigo: string; ambiente: string }>(sql`
    select m.numero, m.token_qr as codigo, a.nombre as ambiente
    from gesnoc.mesa m join gesnoc.ambiente a on a.id = m.ambiente_id
    where m.id = ${mesaId} and m.activa`);
  return fila;
}

/** RN-28: reemplaza el código; el anterior deja de abrir la carta en el mismo instante. */
export async function regenerarCodigo(mesaId: number): Promise<string | undefined> {
  const [fila] = await db()
    .update(mesa)
    .set({ tokenQr: nuevoCodigoDeMesa() })
    .where(and(eq(mesa.id, mesaId), eq(mesa.activa, true)))
    .returning({ codigo: mesa.tokenQr });
  return fila?.codigo;
}
