import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { CLAVE_FORANEA, traducir } from '@/shared/errores';
import type { DatosAmbiente, DatosEstacion } from '../esquemas';
import * as repositorio from '../repositorios/ambientes';

const nombreRepetido = { ambiente_nombre_uq: 'Ya existe un ambiente con ese nombre' };

const restriccionesEstacion = {
  estacion_nombre_uq: 'Ya existe una estación con ese nombre',
  estacion_barra_uq: 'Este ambiente ya tiene una barra', // RN-27
  estacion_ambiente_ck: 'La barra va en un ambiente y la cocina en ninguno',
  [CLAVE_FORANEA]: 'Esta estación tiene productos o comandas asociadas: no se puede eliminar',
};

/**
 * HU-04: cada ambiente con su barra (a lo más una, RN-27) y, aparte, la cocina, que es de todo el
 * local y recibe la comida de todos los ambientes.
 */
export async function listar(actor: Actor) {
  exigir(actor, 'admin');
  const [ambientes, estaciones] = await Promise.all([
    repositorio.listarAmbientes(),
    repositorio.listarEstaciones(),
  ]);
  return {
    ambientes: ambientes.map((ambiente) => ({
      ...ambiente,
      barra: estaciones.find((estacion) => estacion.ambienteId === ambiente.id) ?? null,
    })),
    cocinas: estaciones.filter((estacion) => estacion.ambienteId === null),
  };
}

export type LocalConEstaciones = Awaited<ReturnType<typeof listar>>;
export type AmbienteConBarra = LocalConEstaciones['ambientes'][number];

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

export async function crearEstacion(actor: Actor, datos: DatosEstacion) {
  exigir(actor, 'admin');
  await traducir(repositorio.insertarEstacion(datos), restriccionesEstacion);
}

export async function renombrarEstacion(actor: Actor, id: number, nombre: string) {
  exigir(actor, 'admin');
  await traducir(repositorio.renombrarEstacion(id, nombre), restriccionesEstacion);
}

export async function eliminarEstacion(actor: Actor, id: number) {
  exigir(actor, 'admin');
  await traducir(repositorio.eliminarEstacion(id), restriccionesEstacion);
}
