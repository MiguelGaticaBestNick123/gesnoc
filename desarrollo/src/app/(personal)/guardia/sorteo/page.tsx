import { Sorteo } from '@/modules/porteria/Sorteo';
import { pantallaSorteo } from '@/modules/porteria/servicios/sorteo';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Sorteo · GesNoc' };

// HU-37: el sorteo del premio de cada ambiente.
export default async function PaginaSorteo() {
  const actor = await exigirVista('guardia');
  return <Sorteo inicial={await pantallaSorteo(actor)} />;
}
