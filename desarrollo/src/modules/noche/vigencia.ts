// Vigencia de una lista (pedido del Product Owner, 18 nov): una noche (un cumpleaños), varias (los
// bailarines de una temporada) o sin término (los clientes frecuentes). Lógica pura, sin base.

export interface Vigencia {
  /** Primera noche en que vale. */
  desde: string;
  /** Última noche en que vale; `null` si no tiene término. */
  hasta: string | null;
}

export const duraciones = ['noche', 'hasta', 'siempre'] as const;
export type Duracion = (typeof duraciones)[number];

export const duracionDe = ({ desde, hasta }: Vigencia): Duracion =>
  hasta === null ? 'siempre' : hasta === desde ? 'noche' : 'hasta';

/** Si la puerta reconoce a sus personas la noche de `fecha`. */
export const vigenteEn = ({ desde, hasta }: Vigencia, fecha: string): boolean =>
  desde <= fecha && (hasta === null || fecha <= hasta);

/** Ya pasó su última noche: queda como registro de cómo entró la gente y no cambia (RN-26). */
export const terminada = ({ hasta }: Vigencia, hoy: string): boolean =>
  hasta !== null && hasta < hoy;

/** La noche anterior a `fecha` («2026-11-20» → «2026-11-19»). */
export function nocheAnterior(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() - 1);
  return dia.toISOString().slice(0, 10);
}

const formatoDia = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const formatoConDiaDeSemana = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const dia = (fecha: string) => formatoDia.format(new Date(`${fecha}T00:00:00Z`));
const anio = (fecha: string) => fecha.slice(0, 4);
/** «31 de diciembre», con el año si no es el de `respecto`: «15 de enero de 2027». */
const diaRespecto = (fecha: string, respecto: string) =>
  anio(fecha) === anio(respecto) ? dia(fecha) : `${dia(fecha)} de ${anio(fecha)}`;

/**
 * La vigencia como se dice en el local: «Solo el viernes 20 de noviembre», «Del 20 de noviembre al
 * 31 de diciembre» o «Sin término, desde el 1 de noviembre». Vista desde una noche, la lista de esa
 * sola noche es «Solo esta noche».
 */
export function describirVigencia(vigencia: Vigencia, noche?: string): string {
  const { desde, hasta } = vigencia;
  switch (duracionDe(vigencia)) {
    case 'noche':
      return desde === noche
        ? 'Solo esta noche'
        : `Solo el ${formatoConDiaDeSemana.format(new Date(`${desde}T00:00:00Z`)).replace(',', '')}`;
    case 'hasta':
      return `Del ${dia(desde)} al ${diaRespecto(hasta!, desde)}`;
    case 'siempre':
      return `Sin término, desde el ${dia(desde)}`;
  }
}
