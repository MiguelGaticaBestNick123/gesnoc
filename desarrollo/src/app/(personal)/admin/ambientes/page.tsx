import { Ambientes } from '@/modules/local/Ambientes';
import { listar } from '@/modules/local/servicios/ambientes';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Ambientes · GesNoc' };

export default async function PaginaAmbientes() {
  const actor = await exigirVista('admin');
  return <Ambientes ambientes={await listar(actor)} />;
}
