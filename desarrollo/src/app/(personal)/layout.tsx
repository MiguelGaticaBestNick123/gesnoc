import { redirect } from 'next/navigation';
import { nombreDeAmbiente } from '@/modules/local/repositorios/ambientes';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { nombreDelRol } from '@/modules/noche/nombres';
import { inicioDe, type Actor } from '@/shared/autorizacion';
import { actorActual } from '@/shared/sesion';
import { Marco } from '@/shared/ui/Marco';

/** Lo que hace la persona esta noche: «Garzón · Salón», «Administración» o «Sin turno». */
async function puestoDe(actor: Actor): Promise<string> {
  if (actor.esAdministrador) return 'Administración';
  if (!actor.turno) return 'Sin turno esta noche';
  const rol = nombreDelRol[actor.turno.rol] ?? actor.turno.rol;
  const ambiente = actor.turno.ambienteId && (await nombreDeAmbiente(actor.turno.ambienteId));
  return ambiente ? `${rol} · ${ambiente}` : rol;
}

export default async function LayoutPersonal({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await actorActual();
  if (!actor) redirect('/ingresar');
  const [noche, puesto] = await Promise.all([fechaAbierta(), puestoDe(actor)]);

  return (
    <Marco nombre={actor.nombre} puesto={puesto} inicio={inicioDe(actor)} noche={noche ?? null}>
      {children}
    </Marco>
  );
}
