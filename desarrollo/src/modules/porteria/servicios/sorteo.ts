import 'server-only';
import { randomInt } from 'node:crypto';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { bloquearCorrelativo, db } from '@/shared/db/cliente';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import { elegirGanador, type Azar } from '../ganador';
import * as repositorio from '../repositorios/sorteo';

// HU-37: el sorteo del premio de cada ambiente. Un sorteo por ambiente y noche, entre los tickets de
// la noche que aún no ganan (RN-23). El premio es el que la administración eligió del catálogo.

/** Cada ambiente con su premio y, si ya sorteó, el ganador; y cuántos tickets participan. */
export async function pantallaSorteo(actor: Actor) {
  exigir(actor, 'guardia');
  const fecha = await fechaAbierta();
  if (!fecha) return { noche: null, participantes: 0, ultimoTicket: 0, ambientes: [] };
  const [ambientes, participantes] = await Promise.all([
    repositorio.ambientesActivos(),
    repositorio.ticketsQueParticipan(db(), fecha),
  ]);
  return {
    noche: fecha,
    participantes: participantes.length,
    ultimoTicket: participantes.at(-1) ?? 0,
    ambientes: await Promise.all(
      ambientes.map(async (ambiente) => ({
        ...ambiente,
        premio: await repositorio.premioEnPalabras(db(), fecha, ambiente.id),
        ganador: (await repositorio.sorteoDe(db(), fecha, ambiente.id)) ?? null,
      })),
    ),
  };
}

export type PantallaSorteo = Awaited<ReturnType<typeof pantallaSorteo>>;

/**
 * Sortea en el servidor, con los sorteos de la noche bloqueados: si el ambiente ya sorteó (por
 * ejemplo, un reintento tras un corte), devuelve ese mismo ganador y no saca otro. El azar viene de
 * `crypto.randomInt`; las pruebas pasan una fuente fija.
 */
export async function sortear(actor: Actor, ambienteId: number, azar: Azar = randomInt) {
  exigir(actor, 'guardia');
  return enLaNoche(async (tx, fecha) => {
    await bloquearCorrelativo(tx, 'sorteo', fecha);
    const previo = await repositorio.sorteoDe(tx, fecha, ambienteId);
    if (previo) return { ...previo, repetido: true };

    const premio = await repositorio.premioEnPalabras(tx, fecha, ambienteId);
    if (!premio) {
      throw new ErrorDeNegocio(
        'Este ambiente no tiene premio: la administración lo elige en el calendario',
      );
    }
    const tickets = await repositorio.ticketsQueParticipan(tx, fecha);
    if (tickets.length === 0) throw new ErrorDeNegocio('No hay tickets para sortear');
    const ticket = elegirGanador(tickets, azar);
    await traducir(
      repositorio.insertarSorteo(tx, { fecha, ambienteId, premio, ticket, realizadoPor: actor.id }),
      { '23503': 'Ese ambiente no existe' },
    );
    return { ...(await repositorio.sorteoDe(tx, fecha, ambienteId))!, repetido: false };
  });
}

export type Ganador = Awaited<ReturnType<typeof sortear>>;
