const formato = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** Fecha operativa de una noche, por ejemplo «viernes, 6 de noviembre». */
export function formatearFecha(fecha: string): string {
  return formato.format(new Date(`${fecha}T00:00:00Z`));
}

/** La misma fecha como encabezado: «Viernes, 6 de noviembre». */
export function tituloDeFecha(fecha: string): string {
  const texto = formatearFecha(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const formatoHora = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Santiago',
});

/** Hora en Chile de una marca de tiempo de la base («2026-11-07 23:15:02+00»), como «20:15». */
export function formatearHora(marca: string): string {
  const iso = marca.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  return formatoHora.format(new Date(iso));
}

const formatoCorto = new Intl.DateTimeFormat('es-CL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** Fecha operativa abreviada para espacios chicos: «vie 7 nov». */
export function fechaCorta(fecha: string): string {
  return formatoCorto
    .formatToParts(new Date(`${fecha}T00:00:00Z`))
    .filter((parte) => parte.type !== 'literal')
    .map((parte) => parte.value.replace('.', ''))
    .join(' ');
}

/** Tiempo transcurrido legible: «12 min», «1 h 03 min». */
export function duracion(segundos: number): string {
  const minutosTotales = Math.max(0, Math.floor(segundos / 60));
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  if (horas === 0) return `${minutos} min`;
  return `${horas} h ${String(minutos).padStart(2, '0')} min`;
}

/** Fecha de hoy en Chile, «2026-11-12»: la noche se piensa en hora local, no en UTC. */
export function hoyEnChile(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}
