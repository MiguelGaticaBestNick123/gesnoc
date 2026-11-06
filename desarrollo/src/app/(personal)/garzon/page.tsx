import { ambientes } from '@/modules/local/demostracion';
import { cuentasAbiertas } from '@/modules/venta/demostracion';
import { MapaMesas } from '@/modules/venta/MapaMesas';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Mesas · GesNoc' };

// Vista del garzón (RF-15): el mapa de cada ambiente con el estado de sus mesas.
// Por ahora usa el local de demostración; la consulta a la base llega con HU-13.
export default async function PaginaGarzon() {
  await exigirVista('garzon');
  return <MapaMesas ambientes={ambientes} cuentas={cuentasAbiertas} />;
}
