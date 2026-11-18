// El aviso de una noche para el grupo de WhatsApp del equipo: así se convoca hoy al personal, y el
// mensaje lleva lo que la administración ya cargó (nota, premios y eventos) y el enlace a GesNoc.
import { formatearPesos } from '@/shared/utilidades/dinero';
import { tituloDeFecha } from '@/shared/utilidades/fechas';

export interface DatosDelAviso {
  fecha: string;
  precioEntrada: number;
  nota: string | null;
  premios: { ambiente: string; premio: string }[];
  eventos: { hora: string | null; nombre: string }[];
}

export function mensajeDeLaNoche(datos: DatosDelAviso, origen: string): string {
  const lineas = [`*${tituloDeFecha(datos.fecha)}*: abrimos.`];
  lineas.push(`Entrada ${formatearPesos(datos.precioEntrada)}.`);
  if (datos.nota) lineas.push(datos.nota);
  for (const { ambiente, premio } of datos.premios)
    lineas.push(`Sorteo en ${ambiente}: ${premio}.`);
  for (const evento of datos.eventos) {
    lineas.push(`${evento.hora ? `${evento.hora} · ` : ''}${evento.nombre}`);
  }
  lineas.push(`Marca si puedes venir en GesNoc: ${origen}`);
  return lineas.join('\n');
}

/** El enlace que abre WhatsApp con el mensaje escrito; la persona elige el grupo y lo envía. */
export const enlaceDeWhatsApp = (mensaje: string) =>
  `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
