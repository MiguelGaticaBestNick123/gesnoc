import 'server-only';
import { listarAmbientes } from '@/modules/local/repositorios/ambientes';
import { exigir, type Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import type { DatosAsignacion } from '../esquemas';
import { buscarNoche, listarNoches } from '../repositorios/noches';
import * as repositorio from '../repositorios/turnos';

export async function misTurnos(actor: Actor) {
  exigir(actor, 'personal');
  const filas = await repositorio.turnosDe(actor.id);
  return filas.map(({ abiertaEn, disponible, ...fila }) => ({
    ...fila,
    abierta: abiertaEn !== null,
    disponible: disponible !== null,
  }));
}

export type MiTurno = Awaited<ReturnType<typeof misTurnos>>[number];

// RN-03: solo se declara disponibilidad en noches programadas que aún no se abren.
export async function declararDisponibilidad(actor: Actor, fecha: string, disponible: boolean) {
  exigir(actor, 'personal');
  const noche = await buscarNoche(fecha);
  if (!noche || noche.abiertaEn) {
    throw new ErrorDeNegocio('Solo puedes declararte disponible en noches programadas');
  }
  if (disponible) await repositorio.declararDisponible(fecha, actor.id);
  else await repositorio.retirarDisponible(fecha, actor.id);
}

/** Lo que necesita la pantalla de asignación para una noche; sin fecha, toma la primera vigente. */
export async function pantallaAsignacion(actor: Actor, fecha?: string) {
  exigir(actor, 'admin');
  const noches = (await listarNoches()).filter((noche) => !noche.cerradaEn);
  const elegida = noches.find((noche) => noche.fecha === fecha) ?? noches[0];
  if (!elegida) return { noches, elegida, dotacion: [], ambientes: [] };

  const [dotacion, ambientes] = await Promise.all([
    repositorio.dotacionDe(elegida.fecha),
    listarAmbientes(),
  ]);
  return {
    noches,
    elegida,
    dotacion: dotacion.map(({ disponible, ...persona }) => ({
      ...persona,
      disponible: disponible !== null,
    })),
    ambientes: ambientes.filter((ambiente) => ambiente.activo),
  };
}

export type Dotacion = Awaited<ReturnType<typeof pantallaAsignacion>>['dotacion'];

async function exigirNocheVigente(fecha: string) {
  const noche = await buscarNoche(fecha);
  if (!noche) throw new ErrorDeNegocio('Esa noche no existe');
  if (noche.cerradaEn) throw new ErrorDeNegocio('Una noche cerrada no admite cambios'); // RN-26
}

export async function asignar(actor: Actor, datos: DatosAsignacion) {
  exigir(actor, 'admin');
  await exigirNocheVigente(datos.fecha);
  const declaro = await repositorio.estaDisponible(datos.fecha, datos.usuarioId);
  if (!declaro && !datos.confirmarSinDisponibilidad) {
    throw new ErrorDeNegocio('Esta persona no declaró disponibilidad: confirma para asignarla');
  }
  await traducir(repositorio.guardarTurno(datos), {
    asignacion_ambiente_ck: 'El guardia no lleva ambiente y los demás roles sí', // RN-04
  });
}

export async function quitar(actor: Actor, fecha: string, usuarioId: number) {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  await repositorio.eliminarTurno(fecha, usuarioId);
}
