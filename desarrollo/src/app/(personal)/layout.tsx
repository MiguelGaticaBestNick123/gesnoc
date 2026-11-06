import { redirect } from 'next/navigation';
import { inicioDe } from '@/shared/autorizacion';
import { actorActual } from '@/shared/sesion';
import { Marco } from '@/shared/ui/Marco';

export default async function LayoutPersonal({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await actorActual();
  if (!actor) redirect('/ingresar');

  return (
    <Marco nombre={actor.nombre} inicio={inicioDe(actor)}>
      {children}
    </Marco>
  );
}
