import { NocheEnCurso } from '@/modules/noche/NocheEnCurso';
import { estado } from '@/modules/noche/servicios/noches';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Noche en curso · GesNoc' };

export default async function PaginaNoche() {
  const actor = await exigirVista('admin');
  return <NocheEnCurso {...await estado(actor)} />;
}
