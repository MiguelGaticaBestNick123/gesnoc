import { ColaEstacion } from '@/modules/venta/ColaEstacion';
import { cola } from '@/modules/venta/servicios/colas';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Cocina · GesNoc' };

// HU-18: la cola de la cocina, sin bebidas, con el número de personas y las notas.
export default async function PaginaCocina() {
  const actor = await exigirVista('cocina');
  return <ColaEstacion inicial={await cola(actor, 'cocina')} />;
}
