import { Text } from '@mantine/core';
import { CuentasAbiertas } from '@/modules/venta/CuentasAbiertas';
import { mapa } from '@/modules/venta/servicios/cuentas';
import { capturarFallaPrevista, ErrorDeNegocio } from '@/shared/errores';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Cuentas abiertas · GesNoc' };

export default async function PaginaCuentas({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ambiente?: string }> }>) {
  const actor = await exigirVista('garzon');
  const { ambiente } = await searchParams;
  const inicial = await capturarFallaPrevista(mapa(actor, Number(ambiente) || undefined));
  if (inicial instanceof ErrorDeNegocio) return <Text c="dimmed">{inicial.message}</Text>;
  return <CuentasAbiertas inicial={inicial} />;
}
