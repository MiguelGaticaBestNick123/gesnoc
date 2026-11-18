import { BitacoraNoche } from '@/modules/noche/BitacoraNoche';
import { bitacora } from '@/modules/noche/servicios/bitacora';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Bitácora · GesNoc' };

// La bitácora de cada noche: `?fecha=` elige la noche; sin ella, la más reciente.
export default async function PaginaBitacora({
  searchParams,
}: Readonly<{ searchParams: Promise<{ fecha?: string }> }>) {
  const actor = await exigirVista('admin');
  const { fecha } = await searchParams;
  const datos = await bitacora(actor, fecha);
  return <BitacoraNoche key={datos.elegida?.fecha ?? 'sin-noche'} datos={datos} />;
}
