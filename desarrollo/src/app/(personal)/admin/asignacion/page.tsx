import { Text } from '@mantine/core';
import { Asignacion } from '@/modules/noche/Asignacion';
import { pantallaAsignacion } from '@/modules/noche/servicios/turnos';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Asignar turnos · GesNoc' };

export default async function PaginaAsignacion({
  searchParams,
}: Readonly<{ searchParams: Promise<{ fecha?: string }> }>) {
  const actor = await exigirVista('admin');
  const { fecha } = await searchParams;
  const { elegida, ...datos } = await pantallaAsignacion(actor, fecha);

  if (!elegida)
    return <Text c="dimmed">No hay noches programadas: crea una en el calendario.</Text>;
  return <Asignacion elegida={elegida} {...datos} />;
}
