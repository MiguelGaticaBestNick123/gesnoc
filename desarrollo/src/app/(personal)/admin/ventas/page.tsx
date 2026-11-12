import { VentasYPropinas } from '@/modules/caja/VentasYPropinas';
import { ventasYPropinas } from '@/modules/caja/servicios/caja';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Ventas y propinas · GesNoc' };

// HU-29: `?fecha=` elige la noche; sin ella, la más reciente.
export default async function PaginaVentas({
  searchParams,
}: Readonly<{ searchParams: Promise<{ fecha?: string }> }>) {
  const actor = await exigirVista('admin');
  const { fecha } = await searchParams;
  const datos = await ventasYPropinas(actor, fecha);
  return <VentasYPropinas key={datos.elegida?.fecha ?? 'sin-noche'} datos={datos} />;
}
