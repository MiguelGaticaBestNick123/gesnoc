import 'server-only';
import { ErrorDeNegocio } from '@/shared/errores';
import { hashDeToken, nuevoToken } from '@/shared/sesion/actor';
import { hashearClave, verificarClave } from '@/shared/sesion/clave';
import * as usuarios from '../repositorios/usuarios';

const credencialesInvalidas = () => new ErrorDeNegocio('Correo o contraseña incorrectos');
const cuentaBloqueada = () =>
  new ErrorDeNegocio('Cuenta bloqueada por 15 minutos tras varios intentos fallidos');

// Se verifica contra este hash cuando el correo no existe, para que el tiempo de respuesta no
// delate qué correos están registrados.
let señuelo: Promise<string> | undefined;

/** Valida las credenciales y abre una sesión; devuelve el token que va en la cookie. */
export async function iniciarSesion(correo: string, clave: string): Promise<string> {
  const persona = await usuarios.buscarParaIngreso(correo);
  if (!persona?.activo) {
    señuelo ??= hashearClave('señuelo');
    await verificarClave(await señuelo, clave);
    throw credencialesInvalidas();
  }
  if (persona.bloqueado) throw cuentaBloqueada();

  if (!(await verificarClave(persona.claveHash, clave))) {
    const bloqueado = await usuarios.registrarIntentoFallido(persona.id);
    throw bloqueado ? cuentaBloqueada() : credencialesInvalidas();
  }

  const token = nuevoToken();
  await usuarios.abrirSesion(persona.id, hashDeToken(token));
  return token;
}

export async function cerrarSesion(token: string) {
  await usuarios.eliminarSesion(hashDeToken(token));
}
