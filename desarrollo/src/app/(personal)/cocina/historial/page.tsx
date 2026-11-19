import { HistorialComandas } from '@/modules/venta/HistorialComandas';
import { historialDeComandas } from '@/modules/venta/servicios/historial';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Historial de comandas · GesNoc' };

// Historial de comandas de la noche (pedido del Product Owner, 18 nov).
export default async function PaginaHistorial() {
  const actor = await exigirVista('cocina');
  return <HistorialComandas datos={await historialDeComandas(actor, 'cocina')} />;
}
