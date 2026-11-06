import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { CLAVE_FORANEA, traducir } from '@/shared/errores';
import type { DatosAmbiente, DatosEstacion } from '../esquemas';
import * as repositorio from '../repositorios/ambientes';

const nombreRepetido = { ambiente_nombre_uq: 'Ya existe un ambiente con ese nombre' };

const restriccionesEstacion = {
  estacion_nombre_uq: 'Ya existe una estación con ese nombre',
  estacion_barra_uq: 'Este ambiente ya tiene una barra', // RN-27
  [CLAVE_FORANEA]: 'Esta estación tiene productos o comandas asociadas: no se puede eliminar',
};

export async function listar(actor: Actor) {
  exigir(actor, 'admin');
  const [ambientes, estaciones] = await Promise.all([
    repositorio.listarAmbientes(),
    repositorio.listarEstaciones(),
  ]);
  return ambientes.map((ambiente) => ({
    ...ambiente,
    estaciones: estaciones.filter((estacion) => estacion.ambienteId === ambiente.id),
  }));
}

export type AmbienteConEstaciones = Awaited<ReturnType<typeof listar>>[number];

export async function crear(actor: Actor, datos: DatosAmbiente) {
  exigir(actor, 'admin');
  await traducir(repositorio.insertarAmbiente(datos), nombreRepetido);
}

export async function editar(actor: Actor, id: number, datos: DatosAmbiente) {
  exigir(actor, 'admin');
  await traducir(repositorio.actualizarAmbiente(id, datos), nombreRepetido);
}

export async function cambiarActivo(actor: Actor, id: number, activo: boolean) {
  exigir(actor, 'admin');
  await repositorio.fijarAmbienteActivo(id, activo);
}

export async function crearEstacion(actor: Actor, ambienteId: number, datos: DatosEstacion) {
  exigir(actor, 'admin');
  await traducir(repositorio.insertarEstacion(ambienteId, datos), restriccionesEstacion);
}

export async function editarEstacion(actor: Actor, id: number, datos: DatosEstacion) {
  exigir(actor, 'admin');
  await traducir(repositorio.actualizarEstacion(id, datos), restriccionesEstacion);
}

export async function eliminarEstacion(actor: Actor, id: number) {
  exigir(actor, 'admin');
  await traducir(repositorio.eliminarEstacion(id), restriccionesEstacion);
}
