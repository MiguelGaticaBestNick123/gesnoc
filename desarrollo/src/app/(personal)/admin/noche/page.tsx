import { estadoDelCierre } from '@/modules/caja/servicios/caja';
import { NocheEnCurso } from '@/modules/noche/NocheEnCurso';
import { estado } from '@/modules/noche/servicios/noches';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Noche en curso · GesNoc' };

export default async function PaginaNoche() {
  const actor = await exigirVista('admin');
  const [noche, cierre] = await Promise.all([estado(actor), estadoDelCierre(actor)]);
  return <NocheEnCurso {...noche} cierre={cierre} />;
}
