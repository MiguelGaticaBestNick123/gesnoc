import { ResumenNoche } from '@/modules/venta/ResumenNoche';
import { resumenDeLaNoche } from '@/modules/venta/servicios/resumen';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Administración · GesNoc' };

// Portada de la administración: la noche abierta en cifras reales, al día cada pocos segundos.
export default async function PaginaAdmin() {
  const actor = await exigirVista('admin');
  return <ResumenNoche inicial={await resumenDeLaNoche(actor)} />;
}
