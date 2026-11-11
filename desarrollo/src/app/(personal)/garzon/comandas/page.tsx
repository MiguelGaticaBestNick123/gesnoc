import { MisComandasVista } from '@/modules/venta/Comandas';
import { misComandas } from '@/modules/venta/servicios/colas';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Comandas · GesNoc' };

// HU-20 y HU-21: las comandas del garzón; las listas se marcan entregadas desde aquí o desde el aviso.
export default async function PaginaComandas() {
  const actor = await exigirVista('garzon');
  return <MisComandasVista inicial={await misComandas(actor)} />;
}
