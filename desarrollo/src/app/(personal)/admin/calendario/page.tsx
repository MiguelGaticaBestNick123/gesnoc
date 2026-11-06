import { Calendario } from '@/modules/noche/Calendario';
import { listar } from '@/modules/noche/servicios/noches';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Calendario · GesNoc' };

export default async function PaginaCalendario() {
  const actor = await exigirVista('admin');
  return <Calendario noches={await listar(actor)} />;
}
