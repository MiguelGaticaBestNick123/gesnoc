import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import type { DatosNoche } from '../esquemas';
import * as repositorio from '../repositorios/noches';

export function listar(actor: Actor) {
  exigir(actor, 'admin');
  return repositorio.listarNoches();
}

export async function programar(actor: Actor, datos: DatosNoche) {
  exigir(actor, 'admin');
  await traducir(repositorio.insertarNoche(datos), {
    noche_pkey: 'Esa noche ya está programada',
  });
}

export async function editar(actor: Actor, datos: DatosNoche) {
  exigir(actor, 'admin');
  const noche = await repositorio.buscarNoche(datos.fecha);
  if (!noche) throw new ErrorDeNegocio('Esa noche no existe');
  if (noche.cerradaEn) throw new ErrorDeNegocio('Una noche cerrada no admite cambios'); // RN-26
  await repositorio.actualizarNoche(datos);
}

export async function eliminar(actor: Actor, fecha: string) {
  exigir(actor, 'admin');
  const eliminadas = await repositorio.eliminarNocheSinAbrir(fecha);
  if (eliminadas.length === 0) {
    throw new ErrorDeNegocio('Solo se puede eliminar una noche que aún no se abre');
  }
}

/** Estado de la noche en curso: la abierta, si la hay, o las que se pueden abrir. */
export async function estado(actor: Actor) {
  exigir(actor, 'admin');
  const [abierta, noches] = await Promise.all([
    repositorio.nocheAbierta(),
    repositorio.listarNoches(),
  ]);
  return { abierta, programadas: noches.filter((noche) => !noche.abiertaEn) };
}

export async function abrir(actor: Actor, fecha: string, fondo: number) {
  exigir(actor, 'admin');
  const abierta = await traducir(repositorio.abrirNoche(fecha, fondo), {
    noche_una_abierta_uq: 'Ya hay una noche abierta', // RN-02
  });
  if (!abierta) throw new ErrorDeNegocio('Esa noche no existe o ya fue abierta');
}
