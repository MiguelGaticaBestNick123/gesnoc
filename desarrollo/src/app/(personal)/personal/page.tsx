import { PantallaTurnos } from '@/modules/noche/PantallaTurnos';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Mis turnos · GesNoc' };

// Vista de quien no tiene turno en la noche abierta (RN-05): solo su calendario.
export default async function PaginaSinTurno({
  searchParams,
}: Readonly<{ searchParams: Promise<{ mes?: string }> }>) {
  return (
    <PantallaTurnos
      actor={await exigirVista('personal')}
      ruta="/personal"
      mes={(await searchParams).mes}
    />
  );
}
