import { PanelIndicadores } from '@/modules/caja/PanelIndicadores';
import { indicadoresDeLaNoche } from '@/modules/caja/servicios/indicadores';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Indicadores · GesNoc' };

// Indicadores de cada noche: `?fecha=` elige la noche; sin ella, la más reciente.
export default async function PaginaIndicadores({
  searchParams,
}: Readonly<{ searchParams: Promise<{ fecha?: string }> }>) {
  const actor = await exigirVista('admin');
  const { fecha } = await searchParams;
  const datos = await indicadoresDeLaNoche(actor, fecha);
  return <PanelIndicadores key={datos.elegida?.fecha ?? 'sin-noche'} datos={datos} />;
}
