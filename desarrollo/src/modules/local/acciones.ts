'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ejecutar, intentar, type EstadoAccion } from '@/shared/acciones';
import { actorActual } from '@/shared/sesion';
import { identificador } from '@/shared/esquemas';
import {
  conId,
  datosActivacion,
  datosAmbiente,
  datosCategoria,
  datosEstacion,
  datosPlano,
  datosProducto,
} from './esquemas';
import * as ambientes from './servicios/ambientes';
import * as catalogo from './servicios/catalogo';
import * as mapa from './servicios/mapa';

type MesaGuardada = Awaited<ReturnType<typeof mapa.guardarPlano>>[number];

const campos = (datos: FormData) => Object.fromEntries(datos);
const idDe = (datos: FormData) => conId.parse(campos(datos)).id;

export async function crearAmbiente(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => ambientes.crear(actor, datosAmbiente.parse(campos(datos))));
}

export async function editarAmbiente(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) =>
    ambientes.editar(actor, idDe(datos), datosAmbiente.parse(campos(datos))),
  );
}

export async function cambiarAmbienteActivo(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { id, activo } = datosActivacion.parse(campos(datos));
    return ambientes.cambiarActivo(actor, id, activo);
  });
}

export async function crearEstacion(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { ambienteId } = z.object({ ambienteId: identificador }).parse(campos(datos));
    return ambientes.crearEstacion(actor, ambienteId, datosEstacion.parse(campos(datos)));
  });
}

export async function editarEstacion(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) =>
    ambientes.editarEstacion(actor, idDe(datos), datosEstacion.parse(campos(datos))),
  );
}

export async function eliminarEstacion(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => ambientes.eliminarEstacion(actor, idDe(datos)));
}

export async function crearCategoria(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => catalogo.crearCategoria(actor, datosCategoria.parse(campos(datos))));
}

export async function editarCategoria(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) =>
    catalogo.editarCategoria(actor, idDe(datos), datosCategoria.parse(campos(datos))),
  );
}

export async function eliminarCategoria(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => catalogo.eliminarCategoria(actor, idDe(datos)));
}

export async function crearProducto(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => catalogo.crearProducto(actor, datosProducto.parse(campos(datos))));
}

export async function editarProducto(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) =>
    catalogo.editarProducto(actor, idDe(datos), datosProducto.parse(campos(datos))),
  );
}

export async function cambiarProductoActivo(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { id, activo } = datosActivacion.parse(campos(datos));
    return catalogo.cambiarProductoActivo(actor, id, activo);
  });
}

/**
 * HU-05: guarda el plano completo que dejó el editor y devuelve las mesas como quedaron (las nuevas
 * con su id), para que el editor siga trabajando sobre lo guardado.
 */
export async function guardarPlano(
  datos: unknown,
): Promise<EstadoAccion & { mesas?: MesaGuardada[] }> {
  const actor = await actorActual();
  if (!actor) redirect('/ingresar');
  let mesas: MesaGuardada[] | undefined;
  const estado = await intentar(async () => {
    mesas = await mapa.guardarPlano(actor, datosPlano.parse(datos));
  });
  if (estado.ok) revalidatePath('/', 'layout');
  return { ...estado, mesas };
}
