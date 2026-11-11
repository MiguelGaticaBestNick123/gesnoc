import { ColaEstacion } from '@/modules/venta/ColaEstacion';
import { cola } from '@/modules/venta/servicios/colas';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Barra · GesNoc' };

// HU-17: la cola de la barra del ambiente del turno; la administración elige cualquier barra.
export default async function PaginaBarra() {
  const actor = await exigirVista('barra');
  return <ColaEstacion inicial={await cola(actor, 'barra')} />;
}
