import { Arqueo } from '@/modules/caja/Arqueo';
import { pantallaArqueo } from '@/modules/caja/servicios/caja';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Arqueo · GesNoc' };

export default async function PaginaArqueo() {
  const actor = await exigirVista('admin');
  return <Arqueo datos={await pantallaArqueo(actor)} />;
}
