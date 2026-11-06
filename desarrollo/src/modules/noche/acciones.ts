'use server';

import { ejecutar, type EstadoAccion } from '@/shared/acciones';
import {
  conFecha,
  datosApertura,
  datosAsignacion,
  datosDisponibilidad,
  datosNoche,
  datosQuitarTurno,
} from './esquemas';
import * as noches from './servicios/noches';
import * as turnos from './servicios/turnos';

const campos = (datos: FormData) => Object.fromEntries(datos);

export async function programarNoche(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => noches.programar(actor, datosNoche.parse(campos(datos))));
}

export async function editarNoche(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => noches.editar(actor, datosNoche.parse(campos(datos))));
}

export async function eliminarNoche(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => noches.eliminar(actor, conFecha.parse(campos(datos)).fecha));
}

export async function abrirNoche(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, fondo } = datosApertura.parse(campos(datos));
    return noches.abrir(actor, fecha, fondo);
  });
}

export async function declararDisponibilidad(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, disponible } = datosDisponibilidad.parse(campos(datos));
    return turnos.declararDisponibilidad(actor, fecha, disponible);
  });
}

export async function asignarTurno(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => turnos.asignar(actor, datosAsignacion.parse(campos(datos))));
}

export async function quitarTurno(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, usuarioId } = datosQuitarTurno.parse(campos(datos));
    return turnos.quitar(actor, fecha, usuarioId);
  });
}
