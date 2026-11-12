import { Text } from '@mantine/core';
import { EditorPlano } from '@/modules/local/EditorPlano';
import { planoParaEditar } from '@/modules/local/servicios/mapa';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Mapa de mesas · GesNoc' };

// HU-05: editor del plano de mesas de cada ambiente.
export default async function PaginaMapa({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ambiente?: string }> }>) {
  const actor = await exigirVista('admin');
  const { ambiente } = await searchParams;
  const datos = await planoParaEditar(actor, Number(ambiente) || undefined);
  if (!datos.ambiente) {
    return <Text c="dimmed">Primero crea un ambiente en «Ambientes y estaciones».</Text>;
  }
  // Cambiar de ambiente vuelve a armar el editor desde lo guardado.
  return <EditorPlano key={datos.ambiente.id} inicial={datos} ambiente={datos.ambiente} />;
}
