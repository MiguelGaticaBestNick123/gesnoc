'use server';

import { ejecutar, type EstadoAccion } from '@/shared/acciones';
import {
  conFecha,
  conNumero,
  datosApertura,
  datosAsignacion,
  datosDisponibilidad,
  datosEvento,
  datosInvitacion,
  datosLista,
  datosListaPegada,
  datosNoche,
  datosPremio,
  datosQuitarInvitacion,
  datosQuitarTurno,
} from './esquemas';
import * as detalles from './servicios/detalles';
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

export async function elegirPremio(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => detalles.elegirPremio(actor, datosPremio.parse(campos(datos))));
}

export async function agregarEvento(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, nombre, hora } = datosEvento.parse(campos(datos));
    return detalles.agregarEvento(actor, fecha, nombre, hora);
  });
}

export async function quitarEvento(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, numero } = conNumero.parse(campos(datos));
    return detalles.quitarEvento(actor, fecha, numero);
  });
}

export async function guardarLista(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => detalles.guardarLista(actor, datosLista.parse(campos(datos))));
}

export async function quitarLista(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, numero } = conNumero.parse(campos(datos));
    return detalles.quitarLista(actor, fecha, numero);
  });
}

export async function invitar(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => detalles.invitar(actor, datosInvitacion.parse(campos(datos))));
}

export async function pegarLista(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, listaNumero, texto } = datosListaPegada.parse(campos(datos));
    return detalles.pegarLista(actor, fecha, listaNumero, texto);
  });
}

export async function quitarInvitacion(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { fecha, documento } = datosQuitarInvitacion.parse(campos(datos));
    return detalles.quitarInvitacion(actor, fecha, documento);
  });
}
