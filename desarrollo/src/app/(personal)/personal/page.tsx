import { EnConstruccion } from '@/shared/ui/EnConstruccion';

export const metadata = { title: 'Mis turnos · GesNoc' };

// Vista de quien no tiene turno en la noche abierta (RN-05): solo su calendario.
export default function PaginaSinTurno() {
  return (
    <EnConstruccion
      titulo="Mis turnos"
      descripcion="Calendario de turnos asignados y declaración de disponibilidad."
      historias={['HU-09']}
    />
  );
}
