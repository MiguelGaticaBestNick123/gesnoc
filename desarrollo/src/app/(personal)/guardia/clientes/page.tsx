import { Clientes } from '@/modules/porteria/Clientes';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Clientes · GesNoc' };

// HU-35 y HU-36: el guardia busca a un cliente para ver su historial o reportarlo.
export default async function PaginaClientes() {
  await exigirVista('guardia');
  return <Clientes />;
}
