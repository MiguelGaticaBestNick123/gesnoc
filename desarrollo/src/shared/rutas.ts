import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio, esDatoInvalido, NoAutorizado, sinDatosPersonales } from '@/shared/errores';
import { actorActual } from '@/shared/sesion';

const sinCache = { 'cache-control': 'no-store' };

const error = (mensaje: string, status: number) =>
  NextResponse.json({ error: mensaje }, { status, headers: sinCache });

/**
 * Marco de las rutas de operación de la noche (pedidos, cobros, colas). Exige sesión y responde
 * con códigos que el teléfono sabe leer: 4xx significa que no se registró nada; un 5xx, que no se
 * sabe, y entonces el reintento con la misma clave de envío es seguro.
 */
export async function operar(operacion: (actor: Actor) => Promise<unknown>) {
  const actor = await actorActual();
  if (!actor) return error('La sesión expiró: vuelve a ingresar', 401);
  try {
    return NextResponse.json(await operacion(actor), { headers: sinCache });
  } catch (falla) {
    if (falla instanceof NoAutorizado) return error(falla.message, 403);
    if (falla instanceof ErrorDeNegocio) return error(falla.message, 409);
    if (falla instanceof z.ZodError)
      return error(falla.issues[0]?.message ?? 'Datos no válidos', 422);
    // Un número o una fecha que la base no acepta: no se registró nada, así que no es un corte.
    if (esDatoInvalido(falla)) return error('Datos no válidos', 422);
    throw sinDatosPersonales(falla);
  }
}

export async function leerJson(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json();
  } catch {
    throw new ErrorDeNegocio('La solicitud no trae datos válidos');
  }
}
