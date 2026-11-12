import { CuentasConSaldo } from '@/modules/caja/CuentasConSaldo';
import { pantallaSaldos } from '@/modules/caja/servicios/caja';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Cuentas con saldo · GesNoc' };

export default async function PaginaSaldos() {
  const actor = await exigirVista('admin');
  return <CuentasConSaldo datos={await pantallaSaldos(actor)} />;
}
