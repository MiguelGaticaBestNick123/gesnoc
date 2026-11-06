import { colaDe } from '@/modules/venta/demostracion';
import { ColaEstacion } from '@/modules/venta/ColaEstacion';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Cocina · GesNoc' };

export default async function PaginaCocina() {
  await exigirVista('cocina');
  return <ColaEstacion titulo="Cocina" comandas={colaDe('Cocina')} />;
}
