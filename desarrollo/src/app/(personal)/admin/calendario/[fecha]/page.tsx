import { notFound } from 'next/navigation';
import { DetalleNoche } from '@/modules/noche/DetalleNoche';
import { detalleDeNoche } from '@/modules/noche/servicios/detalles';
import { fecha as fechaValida } from '@/shared/esquemas';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Noche · GesNoc' };

// La página de una noche: premio, eventos, listas e invitados, además de la entrada y la nota.
export default async function PaginaNoche({
  params,
}: Readonly<{ params: Promise<{ fecha: string }> }>) {
  const actor = await exigirVista('admin');
  const { fecha } = await params;
  if (!fechaValida.safeParse(fecha).success) notFound();
  const detalle = await detalleDeNoche(actor, fecha);
  if (!detalle) notFound();
  return <DetalleNoche detalle={detalle} />;
}
