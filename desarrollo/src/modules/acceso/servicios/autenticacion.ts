import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio } from '@/shared/errores';
import { hashDeToken, nuevoToken } from '@/shared/sesion/actor';
import { hashearClave, verificarClave } from '@/shared/sesion/clave';
import type { DatosMiClave } from '../esquemas';
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

/**
 * Brecha 5: cada persona cambia su propia contraseña, y así solo ella la conoce (la administración
 * puede restablecerla, pero no verla). Pide la actual: un teléfono olvidado con la sesión abierta no
 * basta para cambiarla, y un error cuenta para el bloqueo igual que en el ingreso. Cierra las demás
 * sesiones de la persona y conserva la actual.
 */
export async function cambiarMiClave(actor: Actor, token: string, { actual, nueva }: DatosMiClave) {
  exigir(actor, 'personal');
  const persona = await usuarios.claveDe(actor.id);
  if (!persona) throw new ErrorDeNegocio('La sesión expiró: vuelve a ingresar');
  if (persona.bloqueado) throw cuentaBloqueada();
  if (!(await verificarClave(persona.claveHash, actual))) {
    const bloqueado = await usuarios.registrarIntentoFallido(actor.id);
    throw bloqueado ? cuentaBloqueada() : new ErrorDeNegocio('La contraseña actual no es correcta');
  }
  await usuarios.reemplazarClavePropia(actor.id, await hashearClave(nueva), hashDeToken(token));
}
