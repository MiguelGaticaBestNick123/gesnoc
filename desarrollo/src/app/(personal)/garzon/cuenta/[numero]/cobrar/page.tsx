import { Text } from '@mantine/core';
import { notFound, redirect } from 'next/navigation';
import { CobrarCliente } from '@/modules/venta/CobrarCliente';
import { detalleCuenta } from '@/modules/venta/servicios/cuentas';
import { capturarFallaPrevista, ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Cobrar · GesNoc' };

// HU-24 y HU-25: cobrar la cuenta en uno o varios pagos.
export default async function PaginaCobro({
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
  return <CobrarCliente inicial={detalle} />;
}
