'use server';

import { redirect } from 'next/navigation';
import { ejecutar, intentar, type EstadoAccion } from '@/shared/acciones';
import { inicioDe } from '@/shared/autorizacion';
import { ErrorDeNegocio } from '@/shared/errores';
import { guardarCookieDeSesion, sacarCookieDeSesion, tokenDeSesion } from '@/shared/sesion';
import { actorDeToken } from '@/shared/sesion/actor';
import {
  datosActivacion,
  datosClave,
  datosEdicion,
  datosIngreso,
  datosMiClave,
  datosPersonaNueva,
} from './esquemas';
import {
  cambiarMiClave as cambiarClavePropia,
  cerrarSesion,
  iniciarSesion,
} from './servicios/autenticacion';
import * as personal from './servicios/personal';

const campos = (datos: FormData) => Object.fromEntries(datos);

export async function ingresar(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  let destino = '/personal';
  const estado = await intentar(async () => {
    const { correo, clave } = datosIngreso.parse(campos(datos));
    const token = await iniciarSesion(correo, clave);
    await guardarCookieDeSesion(token);
    const actor = await actorDeToken(token);
    if (actor) destino = inicioDe(actor);
  });
  if (estado.error) return estado;
  redirect(destino);
}

export async function salir() {
  const token = await sacarCookieDeSesion();
  if (token) await cerrarSesion(token);
  redirect('/ingresar');
}

export async function crearPersona(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => personal.crear(actor, datosPersonaNueva.parse(campos(datos))));
}

export async function editarPersona(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { id, ...persona } = datosEdicion.parse(campos(datos));
    return personal.editar(actor, id, persona);
  });
}

export async function restablecerClave(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { id, clave } = datosClave.parse(campos(datos));
    return personal.restablecerClave(actor, id, clave);
  });
}

export async function cambiarActivo(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { id, activo } = datosActivacion.parse(campos(datos));
    return personal.cambiarActivo(actor, id, activo);
  });
}

/** Brecha 5: la persona cambia su propia contraseña; sigue con la sesión abierta en este teléfono. */
export async function cambiarMiClave(_: EstadoAccion, datos: FormData) {
  return ejecutar(async (actor) => {
    const token = await tokenDeSesion();
    if (!token) throw new ErrorDeNegocio('La sesión expiró: vuelve a ingresar');
    return cambiarClavePropia(actor, token, datosMiClave.parse(campos(datos)));
  });
}
