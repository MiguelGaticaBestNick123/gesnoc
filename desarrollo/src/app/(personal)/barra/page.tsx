import { colaDe } from '@/modules/venta/demostracion';
import { ColaEstacion } from '@/modules/venta/ColaEstacion';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Barra · GesNoc' };

export default async function PaginaBarra() {
  await exigirVista('barra');
  return <ColaEstacion titulo="Barra Salón" comandas={colaDe('Barra Salón')} />;
}
