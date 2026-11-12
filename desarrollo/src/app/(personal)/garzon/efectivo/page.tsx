import { EfectivoPorEntregar } from '@/modules/venta/EfectivoPorEntregar';
import { miEfectivo } from '@/modules/venta/servicios/pagos';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Efectivo por entregar · GesNoc' };

// CU-18 paso 6: el efectivo cobrado que el garzón aún debe entregar a la administración.
export default async function PaginaEfectivo() {
  const actor = await exigirVista('garzon');
  return <EfectivoPorEntregar inicial={await miEfectivo(actor)} />;
}
