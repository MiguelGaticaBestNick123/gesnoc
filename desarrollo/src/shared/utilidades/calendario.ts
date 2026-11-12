// Grilla de un mes para los calendarios de noches y de turnos. Lógica pura con fechas de texto
// («2026-11-14»): no depende de la zona horaria del teléfono.

export const DIAS_DE_LA_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const NOMBRES_DE_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const comoFecha = (anio: number, mes: number, dia: number) =>
  new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10);

/** «2026-11» si el texto es un mes válido; si no, nulo. */
export function mesValido(texto: string | undefined | null): string | null {
  if (!texto || !/^\d{4}-(0[1-9]|1[0-2])$/.test(texto)) return null;
  return texto;
}

export const mesDe = (fecha: string) => fecha.slice(0, 7);

/** El mes a `desplazamiento` meses de distancia: `mesSiguiente('2026-12', 1)` es `'2027-01'`. */
export function mesSiguiente(mes: string, desplazamiento: number): string {
  const [anio, numero] = mes.split('-').map(Number);
  return comoFecha(anio!, numero! + desplazamiento, 1).slice(0, 7);
}

export function tituloDeMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  return `${NOMBRES_DE_MES[numero! - 1]} ${anio}`;
}

/** Primer y último día del mes. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, numero] = mes.split('-').map(Number);
  return { desde: comoFecha(anio!, numero!, 1), hasta: comoFecha(anio!, numero! + 1, 0) };
}

/**
 * Días que muestra la grilla: semanas completas de lunes a domingo, desde la que contiene el día 1
 * hasta la que contiene el último día del mes.
 */
export function diasDeLaGrilla(mes: string): string[] {
  const { desde, hasta } = rangoDelMes(mes);
  const primero = new Date(`${desde}T00:00:00Z`);
  const ultimo = new Date(`${hasta}T00:00:00Z`);
  // getUTCDay: 0 es domingo. Se retrocede hasta el lunes y se avanza hasta el domingo.
  primero.setUTCDate(primero.getUTCDate() - ((primero.getUTCDay() + 6) % 7));
  ultimo.setUTCDate(ultimo.getUTCDate() + ((7 - ultimo.getUTCDay()) % 7));
  const dias: string[] = [];
  for (const dia = primero; dia <= ultimo; dia.setUTCDate(dia.getUTCDate() + 1)) {
    dias.push(dia.toISOString().slice(0, 10));
  }
  return dias;
}
