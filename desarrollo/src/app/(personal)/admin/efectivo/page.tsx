import { ConfirmarEfectivo } from '@/modules/caja/ConfirmarEfectivo';
import { pantallaEfectivo } from '@/modules/caja/servicios/caja';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Confirmar efectivo · GesNoc' };

export default async function PaginaEfectivo() {
  const actor = await exigirVista('admin');
  return <ConfirmarEfectivo datos={await pantallaEfectivo(actor)} />;
}
