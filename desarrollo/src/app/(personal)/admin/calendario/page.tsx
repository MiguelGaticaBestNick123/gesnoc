import { CalendarioNoches } from '@/modules/noche/CalendarioNoches';
import { calendarioDelMes } from '@/modules/noche/servicios/noches';
import { exigirVista } from '@/shared/sesion';
import { mesDe, mesValido } from '@/shared/utilidades/calendario';
import { hoyEnChile } from '@/shared/utilidades/fechas';

export const metadata = { title: 'Calendario · GesNoc' };

const fechaValida = (texto?: string) => (texto && /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null);

// HU-08: el calendario de noches del mes; `?dia=` abre el detalle de ese día.
export default async function PaginaCalendario({
  searchParams,
}: Readonly<{ searchParams: Promise<{ mes?: string; dia?: string }> }>) {
  const actor = await exigirVista('admin');
  const { mes, dia } = await searchParams;
  const diaElegido = fechaValida(dia);
  const mesElegido = mesValido(mes) ?? mesDe(diaElegido ?? hoyEnChile());
  const datos = await calendarioDelMes(actor, mesElegido);
  // Cambiar de mes o de día vuelve a armar el calendario con lo pedido.
  return (
    <CalendarioNoches key={`${mesElegido}-${diaElegido}`} datos={datos} diaInicial={diaElegido} />
  );
}
