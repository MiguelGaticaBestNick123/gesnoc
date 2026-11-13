import { LlamadosVista } from '@/modules/venta/Llamados';
import { misComandas } from '@/modules/venta/servicios/colas';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Llamados · GesNoc' };

// HU-40: los llamados de las mesas del ambiente del garzón, para marcarlos como atendidos.
export default async function PaginaLlamados() {
  const actor = await exigirVista('garzon');
  return <LlamadosVista inicial={await misComandas(actor)} />;
}
