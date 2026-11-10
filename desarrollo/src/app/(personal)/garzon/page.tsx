import { Text } from '@mantine/core';
import { MapaMesas } from '@/modules/venta/MapaMesas';
import { mapa } from '@/modules/venta/servicios/cuentas';
import { capturarFallaPrevista, ErrorDeNegocio } from '@/shared/errores';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Mesas · GesNoc' };

// Vista del garzón (RF-15): el mapa de su ambiente con el estado de cada mesa.
export default async function PaginaGarzon() {
  const actor = await exigirVista('garzon');
  const inicial = await capturarFallaPrevista(mapa(actor));
  if (inicial instanceof ErrorDeNegocio) return <Text c="dimmed">{inicial.message}</Text>;
  return <MapaMesas inicial={inicial} />;
}
