import { EstadoDeLaPuerta } from '@/modules/porteria/EstadoDeLaPuerta';
import { ingresosDeLaNoche } from '@/modules/porteria/servicios/puerta';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Estado de la puerta · GesNoc' };

// HU-32: quiénes entraron esta noche, al día con los ingresos de los otros guardias (RNF-05).
export default async function PaginaEstadoDeLaPuerta() {
  const actor = await exigirVista('guardia');
  return <EstadoDeLaPuerta inicial={await ingresosDeLaNoche(actor)} />;
}
