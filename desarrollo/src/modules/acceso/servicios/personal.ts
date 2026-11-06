import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import { hashearClave } from '@/shared/sesion/clave';
import type { DatosPersona, DatosPersonaNueva } from '../esquemas';
import * as usuarios from '../repositorios/usuarios';

const correoRepetido = { usuario_correo_uq: 'Ya existe una cuenta con ese correo' };

export function listar(actor: Actor) {
  exigir(actor, 'admin');
  return usuarios.listarPersonal();
}

export async function crear(actor: Actor, { clave, ...datos }: DatosPersonaNueva) {
  exigir(actor, 'admin');
  const claveHash = await hashearClave(clave);
  await traducir(usuarios.insertarPersona({ ...datos, claveHash }), correoRepetido);
}

export async function editar(actor: Actor, id: number, datos: DatosPersona) {
  exigir(actor, 'admin');
  if (id === actor.id && !datos.esAdministrador) {
    throw new ErrorDeNegocio('No puedes quitarte tu propio acceso de administración');
  }
  await traducir(usuarios.actualizarPersona(id, datos), correoRepetido);
}

export async function restablecerClave(actor: Actor, id: number, clave: string) {
  exigir(actor, 'admin');
  await usuarios.reemplazarClave(id, await hashearClave(clave));
}

export async function cambiarActivo(actor: Actor, id: number, activo: boolean) {
  exigir(actor, 'admin');
  if (id === actor.id) throw new ErrorDeNegocio('No puedes desactivar tu propia cuenta');
  await usuarios.fijarActivo(id, activo);
}
