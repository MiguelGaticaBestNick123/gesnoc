import 'server-only';
import { sql } from 'drizzle-orm';
import { db, type Conexion, type Transaccion } from '@/shared/db/cliente';

/** El sorteo ya hecho de un ambiente, con el nombre del ganador para compararlo con su cédula. */
export async function sorteoDe(conexion: Conexion, fecha: string, ambienteId: number) {
  const [fila] = await conexion.execute<{
    premio: string;
    ticket: number;
    realizado_en: string;
    nombre: string;
    apellido: string;
    documento: string;
  }>(sql`
    select s.premio, s.ticket_ganador as ticket, s.realizado_en::text as realizado_en,
           c.nombre, c.apellido, c.documento
    from gesnoc.sorteo s
    join gesnoc.entrada e on e.fecha = s.fecha and e.ticket = s.ticket_ganador
    join gesnoc.cliente c on c.id = e.cliente_id
    where s.fecha = ${fecha} and s.ambiente_id = ${ambienteId}`);
  return (
    fila && {
      premio: fila.premio,
      ticket: fila.ticket,
      realizadoEn: fila.realizado_en,
      nombre: fila.nombre,
      apellido: fila.apellido,
      documento: fila.documento,
    }
  );
}

/** RN-23: participan los tickets de la noche que todavía no ganan; las entradas gratis no tienen. */
export async function ticketsQueParticipan(conexion: Conexion, fecha: string): Promise<number[]> {
  const filas = await conexion.execute<{ ticket: number }>(sql`
    select e.ticket from gesnoc.entrada e
    where e.fecha = ${fecha} and e.ticket is not null
      and not exists (select 1 from gesnoc.sorteo s
                      where s.fecha = e.fecha and s.ticket_ganador = e.ticket)
    order by e.ticket`);
  return filas.map((f) => f.ticket);
}

/** El premio de un ambiente en palabras («1 × Botella de ron añejo»), como queda en el sorteo. */
export async function premioEnPalabras(
  conexion: Conexion,
  fecha: string,
  ambienteId: number,
): Promise<string | null> {
  const filas = await conexion.execute<{ texto: string }>(sql`
    select p.cantidad || ' × ' || pr.nombre as texto
    from gesnoc.premio p join gesnoc.producto pr on pr.id = p.producto_id
    where p.fecha = ${fecha} and p.ambiente_id = ${ambienteId}
    order by pr.nombre`);
  if (filas.length === 0) return null;
  const texto = filas.map((f) => f.texto).join(' + ');
  // sorteo.premio admite hasta 80 caracteres: un premio muy largo se acorta al guardarlo.
  return texto.length <= 80 ? texto : `${texto.slice(0, 79)}…`;
}

export const insertarSorteo = (
  tx: Transaccion,
  datos: {
    fecha: string;
    ambienteId: number;
    premio: string;
    ticket: number;
    realizadoPor: number;
  },
) =>
  tx.execute(sql`
    insert into gesnoc.sorteo (fecha, ambiente_id, premio, ticket_ganador, realizado_por)
    values (${datos.fecha}, ${datos.ambienteId}, ${datos.premio}, ${datos.ticket},
            ${datos.realizadoPor})`);

export async function ambientesActivos() {
  const filas = await db().execute<{ id: number; nombre: string }>(sql`
    select id, nombre from gesnoc.ambiente where activo order by nombre`);
  return filas.map((f) => ({ id: f.id, nombre: f.nombre }));
}
