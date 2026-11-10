import { Text } from '@mantine/core';
import { notFound, redirect } from 'next/navigation';
import { PedidoCliente } from '@/modules/venta/PedidoCliente';
import { pantallaPedido } from '@/modules/venta/servicios/cuentas';
import { capturarFallaPrevista, ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Cuenta · GesNoc' };

export default async function PaginaCuenta({
  params,
}: Readonly<{ params: Promise<{ numero: string }> }>) {
  const actor = await exigirVista('garzon');
  const numero = Number((await params).numero);
  if (!Number.isInteger(numero) || numero < 1) notFound();

  const pantalla = await capturarFallaPrevista(pantallaPedido(actor, numero));
  // RN-14: la cuenta de otro ambiente no se muestra; vuelve a su mapa.
  if (pantalla instanceof NoAutorizado) redirect('/garzon');
  if (pantalla instanceof ErrorDeNegocio) return <Text c="dimmed">{pantalla.message}</Text>;
  if (!pantalla) notFound();
  return <PedidoCliente pantalla={pantalla} />;
}
