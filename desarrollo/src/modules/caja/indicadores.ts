// Lógica pura del panel de indicadores de la noche.

export interface PuntoPorHora {
  /** Hora local de Chile, «2026-11-07T23». Ordena bien aunque la noche cruce la medianoche. */
  hora: string;
  /** Lo que se lee bajo la columna: «23:00». */
  etiqueta: string;
  total: number;
}

const HORA = 60 * 60 * 1000;

/**
 * Las horas de la noche con su total, sin huecos: una hora sin ventas aparece con cero, porque un
 * hueco escondido haría ver la noche más pareja de lo que fue. Va desde la primera hora con datos
 * hasta la última.
 */
export function completarHoras(filas: { hora: string; total: number }[]): PuntoPorHora[] {
  if (filas.length === 0) return [];
  const totales = new Map(filas.map((f) => [f.hora, f.total]));
  const ordenadas = [...totales.keys()].sort();
  const aMarca = (hora: string) => Date.parse(`${hora}:00:00Z`);
  const aHora = (marca: number) => new Date(marca).toISOString().slice(0, 13);

  const puntos: PuntoPorHora[] = [];
  for (let marca = aMarca(ordenadas[0]!); marca <= aMarca(ordenadas.at(-1)!); marca += HORA) {
    const hora = aHora(marca);
    puntos.push({ hora, etiqueta: `${hora.slice(11, 13)}:00`, total: totales.get(hora) ?? 0 });
  }
  return puntos;
}

/** Una espera corta, con segundos cuando importan: «45 s», «4 min 30 s», «1 h 05 min». */
export function formatoEspera(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  if (total < 60) return `${total} s`;
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  if (horas > 0) return `${horas} h ${String(minutos).padStart(2, '0')} min`;
  const resto = total % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}
