'use server';

import { z } from 'zod';
import { ejecutar, type EstadoAccion } from '@/shared/acciones';
import { identificador } from '@/shared/esquemas';
import {
  conId,
  datosActivacion,
  datosAmbiente,
  datosCategoria,
  datosEstacion,
  datosProducto,
} from './esquemas';
import * as ambientes from './servicios/ambientes';
import * as catalogo from './servicios/catalogo';

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
