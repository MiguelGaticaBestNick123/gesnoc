import { colaDe } from '@/modules/venta/demostracion';
import { ColaEstacion } from '@/modules/venta/ColaEstacion';

export const metadata = { title: 'Cocina · GesNoc' };

export default function PaginaCocina() {
  return <ColaEstacion titulo="Cocina" comandas={colaDe('Cocina')} />;
}
