import 'server-only';
import { rolPrincipal } from '@/modules/noche/recomendacion';
import { trayectoriaDelPersonal } from '@/modules/noche/repositorios/turnos';
import { exigir, type Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import { hashearClave } from '@/shared/sesion/clave';
import type { DatosPersona, DatosPersonaNueva } from '../esquemas';
import * as usuarios from '../repositorios/usuarios';

const restricciones = {
  usuario_correo_uq: 'Ya existe una cuenta con ese correo',
  usuario_roles_ck: 'El rol alternativo debe ser distinto del habitual',
};

/**
 * HU-03: las cuentas del personal con su trayectoria: el rol que suele hacer (el que definió la
 * administración o, si no lo definió, el que más ha hecho), cuántas noches trabajó, la última y su
 * próximo turno.
 */
export async function listar(actor: Actor) {
  exigir(actor, 'admin');
  const [personas, { roles, proximos }] = await Promise.all([
    usuarios.listarPersonal(),
    trayectoriaDelPersonal(),
  ]);
  return personas.map((persona) => {
    const propios = roles.filter((r) => r.usuarioId === persona.id);
    const proximo = proximos.find((p) => p.usuarioId === persona.id);
    return {
      ...persona,
      principal: persona.rolHabitual ?? rolPrincipal(propios),
      alternativo: persona.rolAlternativo,
      noches: propios.reduce((suma, r) => suma + r.veces, 0),
      ultima:
        propios
          .map((r) => r.ultima)
          .sort()
          .at(-1) ?? null,
      proximo: proximo
        ? { fecha: proximo.fecha, rol: proximo.rol, ambiente: proximo.ambiente }
        : null,
    };
  });
}

export type PersonaDelLocal = Awaited<ReturnType<typeof listar>>[number];

export async function crear(actor: Actor, { clave, ...datos }: DatosPersonaNueva) {
  exigir(actor, 'admin');
  const claveHash = await hashearClave(clave);
  await traducir(usuarios.insertarPersona({ ...datos, claveHash }), restricciones);
}

export async function editar(actor: Actor, id: number, datos: DatosPersona) {
  exigir(actor, 'admin');
  if (id === actor.id && !datos.esAdministrador) {
    throw new ErrorDeNegocio('No puedes quitarte tu propio acceso de administración');
  }
  await traducir(usuarios.actualizarPersona(id, datos), restricciones);
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
