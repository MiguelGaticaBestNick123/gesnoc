import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { inicioDe, puede, type Actor, type Permiso } from '@/shared/autorizacion';
import { actorDeToken } from './actor';

const COOKIE = 'gesnoc_sesion';
const HORAS_DE_SESION = 12;

export async function guardarCookieDeSesion(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: HORAS_DE_SESION * 60 * 60,
    path: '/',
  });
}

export async function sacarCookieDeSesion(): Promise<string | undefined> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE)?.value;
  almacen.delete(COOKIE);
  return token;
}

// `cache` evita repetir la consulta entre el layout y la página de una misma petición.
export const actorActual = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? actorDeToken(token) : null;
});

// Cada página la llama por su cuenta: un layout no se vuelve a ejecutar al navegar dentro de él,
// así que no sirve como única protección.
export async function exigirVista(permiso: Permiso): Promise<Actor> {
  const actor = await actorActual();
  if (!actor) redirect('/ingresar');
  if (!puede(actor, permiso)) redirect(inicioDe(actor));
  return actor;
}
