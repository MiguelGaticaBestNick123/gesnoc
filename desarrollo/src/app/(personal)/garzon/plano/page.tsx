import { Text } from '@mantine/core';
import { EditorPlano } from '@/modules/local/EditorPlano';
import { planoParaEditar } from '@/modules/local/servicios/mapa';
import { capturarFallaPrevista, ErrorDeNegocio } from '@/shared/errores';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Ordenar mesas · GesNoc' };

// Pedido del Product Owner (19 nov): al empezar el turno, el garzón ordena las mesas de su
// ambiente como le acomode. Usa el editor del plano, sin agregar ni retirar mesas.
export default async function PaginaOrdenarMesas({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ambiente?: string }> }>) {
  const actor = await exigirVista('garzon');
  const { ambiente } = await searchParams;
  const datos = await capturarFallaPrevista(planoParaEditar(actor, Number(ambiente) || undefined));
  if (datos instanceof ErrorDeNegocio) return <Text c="dimmed">{datos.message}</Text>;
  if (!datos.ambiente) return <Text c="dimmed">No hay un ambiente activo para ordenar.</Text>;
  // Cambiar de ambiente (la administración) vuelve a armar el editor desde lo guardado.
  return (
    <EditorPlano
      key={datos.ambiente.id}
      inicial={datos}
      ambiente={datos.ambiente}
      base="/garzon/plano"
      volver="/garzon"
    />
  );
}
