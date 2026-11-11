import { Text } from '@mantine/core';
import { notFound, redirect } from 'next/navigation';
import { DetalleCuenta } from '@/modules/venta/DetalleCuenta';
import { detalleCuenta } from '@/modules/venta/servicios/cuentas';
import { capturarFallaPrevista, ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Cuenta · GesNoc' };

// HU-23: el detalle de la cuenta, con lo consumido, lo pagado y el saldo.
export default async function PaginaDetalleCuenta({
  params,
}: Readonly<{ params: Promise<{ numero: string }> }>) {
  const actor = await exigirVista('garzon');
  const numero = Number((await params).numero);
  if (!Number.isInteger(numero) || numero < 1) notFound();

  const detalle = await capturarFallaPrevista(detalleCuenta(actor, numero));
  // RN-14: la cuenta de otro ambiente no se muestra; vuelve a su mapa.
  if (detalle instanceof NoAutorizado) redirect('/garzon');
  if (detalle instanceof ErrorDeNegocio) return <Text c="dimmed">{detalle.message}</Text>;
  if (!detalle) notFound();
  return <DetalleCuenta inicial={detalle} />;
}
