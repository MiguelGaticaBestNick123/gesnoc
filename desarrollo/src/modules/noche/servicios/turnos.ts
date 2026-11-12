import 'server-only';
import { listarAmbientes } from '@/modules/local/repositorios/ambientes';
import { exigir, type Actor, type RolTurno } from '@/shared/autorizacion';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import { rangoDelMes } from '@/shared/utilidades/calendario';
import { hoyEnChile } from '@/shared/utilidades/fechas';
import type { DatosAsignacion } from '../esquemas';
import { buscarNoche, listarNoches } from '../repositorios/noches';
import { rolPrincipal } from '../recomendacion';
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

  const [dotacion, ambientes, historial] = await Promise.all([
    repositorio.dotacionDe(elegida.fecha),
    listarAmbientes(),
    repositorio.historialDeRoles(elegida.fecha),
  ]);
  return {
    noches,
    elegida,
    dotacion: dotacion.map(({ disponible, rol, ...persona }) => {
      const propio = historial.filter((h) => h.usuarioId === persona.id);
      return {
        ...persona,
        rol: rol as RolTurno | null,
        disponible: disponible !== null,
        // Rol habitual según su historial, para recomendarla al asignar (no se guarda).
        principal: rolPrincipal(propio),
        veces: Object.fromEntries(propio.map((h) => [h.rol, h.veces])) as Partial<
          Record<RolTurno, number>
        >,
      };
    }),
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

/**
 * El calendario del mes de una persona: en qué noches tuvo o tiene turno y de qué rol, a cuáles
 * postuló y a cuáles todavía puede postular.
 */
export async function miCalendario(actor: Actor, mes: string) {
  exigir(actor, 'personal');
  const { desde, hasta } = rangoDelMes(mes);
  const noches = await repositorio.mesDe(actor.id, desde, hasta);
  return {
    mes,
    hoy: hoyEnChile(),
    noches: Object.fromEntries(noches.map((noche) => [noche.fecha, noche])),
  };
}

export type MiCalendario = Awaited<ReturnType<typeof miCalendario>>;
