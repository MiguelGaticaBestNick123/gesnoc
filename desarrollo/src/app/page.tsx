import { redirect } from 'next/navigation';
import { inicioDe } from '@/shared/autorizacion';
import { actorActual } from '@/shared/sesion';

// RF-04: la portada dirige a cada persona a la pantalla del rol que tiene en la noche abierta.
export default async function Inicio() {
  const actor = await actorActual();
  redirect(actor ? inicioDe(actor) : '/ingresar');
}
