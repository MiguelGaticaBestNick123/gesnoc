import { Personal } from '@/modules/acceso/Personal';
import { listar } from '@/modules/acceso/servicios/personal';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Personal · GesNoc' };

export default async function PaginaPersonal() {
  const actor = await exigirVista('admin');
  return <Personal personas={await listar(actor)} />;
}
