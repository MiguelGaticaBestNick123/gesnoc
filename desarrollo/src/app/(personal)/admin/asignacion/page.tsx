import { Asignacion } from '@/modules/noche/Asignacion';
import { pantallaAsignacion } from '@/modules/noche/servicios/turnos';
import { exigirVista } from '@/shared/sesion';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';

export const metadata = { title: 'Asignar turnos · GesNoc' };

export default async function PaginaAsignacion({
  searchParams,
}: Readonly<{ searchParams: Promise<{ fecha?: string }> }>) {
  const actor = await exigirVista('admin');
  const { fecha } = await searchParams;
  const { elegida, ...datos } = await pantallaAsignacion(actor, fecha);

  if (!elegida)
    return (
      <EstadoVacio
        texto="No hay noches programadas para asignar turnos."
        accion="Ir al calendario de noches"
        href="/admin/calendario"
      />
    );
  return <Asignacion elegida={elegida} {...datos} />;
}
