import 'server-only';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio } from '@/shared/errores';
import { actorActual } from '@/shared/sesion';

/** Resultado de una acción de servidor, tal como lo recibe el formulario. */
export interface EstadoAccion {
  ok?: boolean;
  error?: string;
}

/** Corre una operación y devuelve como mensaje las fallas previstas; las demás siguen de largo. */
export async function intentar(operacion: () => Promise<unknown>): Promise<EstadoAccion> {
  try {
    await operacion();
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return { error: error.message };
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? 'Datos no válidos' };
    }
    throw error;
  }
}

/** Marco de toda acción del personal: exige sesión y refresca lo que se ve. */
export async function ejecutar(
  operacion: (actor: Actor) => Promise<unknown>,
): Promise<EstadoAccion> {
  const actor = await actorActual();
  if (!actor) redirect('/ingresar');
  const estado = await intentar(() => operacion(actor));
  if (estado.ok) revalidatePath('/', 'layout');
  return estado;
}
