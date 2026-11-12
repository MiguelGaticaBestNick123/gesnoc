import { Puerta } from '@/modules/porteria/Puerta';
import { ingresosDeLaNoche } from '@/modules/porteria/servicios/puerta';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Entrada · GesNoc' };

// HU-30 y HU-33: la puerta registra a cada persona una vez por noche, con su ticket si pagó.
export default async function PaginaGuardia() {
  const actor = await exigirVista('guardia');
  return <Puerta inicial={await ingresosDeLaNoche(actor)} />;
}
