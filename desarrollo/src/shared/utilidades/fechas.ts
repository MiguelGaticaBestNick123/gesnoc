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
