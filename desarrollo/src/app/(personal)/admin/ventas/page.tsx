import { VentasYPropinas } from '@/modules/caja/VentasYPropinas';
import { ventasYPropinas } from '@/modules/caja/servicios/caja';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Ventas y propinas · GesNoc' };

// HU-29: `?fecha=` elige la noche; sin ella, la más reciente. `?cerrada=` llega desde el cierre de
// la noche (CU-11 paso 6), con cuántos clientes se anonimizaron.
export default async function PaginaVentas({
  searchParams,
}: Readonly<{ searchParams: Promise<{ fecha?: string; cerrada?: string }> }>) {
  const actor = await exigirVista('admin');
  const { fecha, cerrada } = await searchParams;
  const datos = await ventasYPropinas(actor, fecha);
  const anonimizados = Number(cerrada);
  return (
    <VentasYPropinas
      key={datos.elegida?.fecha ?? 'sin-noche'}
      datos={datos}
      recienCerrada={
        datos.elegida?.cerrada && Number.isInteger(anonimizados) && anonimizados >= 0
          ? { anonimizados }
          : null
      }
    />
  );
}
