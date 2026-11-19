import { PantallaListas } from '@/modules/noche/ListasVigentes';
import { pantallaListas } from '@/modules/noche/servicios/listas';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Listas · GesNoc' };

// HU-34, ajustada por el Product Owner (18 nov): listas de una noche, de varias o sin término, como
// la de los clientes frecuentes, que la puerta reconoce mientras están vigentes.
export default async function PaginaListas() {
  const actor = await exigirVista('admin');
  return <PantallaListas datos={await pantallaListas(actor)} />;
}
