import { colaDe } from '@/modules/venta/demostracion';
import { ColaEstacion } from '@/modules/venta/ColaEstacion';

export const metadata = { title: 'Barra · GesNoc' };

export default function PaginaBarra() {
  return <ColaEstacion titulo="Barra Salón" comandas={colaDe('Barra Salón')} />;
}
