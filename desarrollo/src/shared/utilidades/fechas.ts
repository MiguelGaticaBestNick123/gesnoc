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
