import { Clientes } from '@/modules/porteria/Clientes';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Clientes · GesNoc' };

// HU-36: la administración consulta el historial de un cliente y puede reportarlo (RN-25).
export default async function PaginaClientes() {
  await exigirVista('admin');
  return <Clientes />;
}
