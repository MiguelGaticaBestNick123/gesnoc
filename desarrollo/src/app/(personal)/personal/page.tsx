import { PantallaTurnos } from '@/modules/noche/PantallaTurnos';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Mis turnos · GesNoc' };

// Vista de quien no tiene turno en la noche abierta (RN-05): solo su calendario.
export default async function PaginaSinTurno() {
  return <PantallaTurnos actor={await exigirVista('personal')} />;
}
