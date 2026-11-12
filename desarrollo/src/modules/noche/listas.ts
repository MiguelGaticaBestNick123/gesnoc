import { normalizarRut } from '@/shared/utilidades/rut';

export interface PersonaDeLista {
  documento: string;
  nombre: string;
  apellido: string;
}

// Un RUT escrito como sea: con o sin puntos, con o sin guion.
const PATRON_RUT = /\d{1,2}\.?\d{3}\.?\d{3}\s*-?\s*[\dkK]\b/;

/**
 * Lee la lista que envía quien organiza (por ejemplo, copiada de un mensaje): una persona por línea,
 * con su RUT y su nombre en cualquier orden. «12.345.678-5 Camila Rojas» y «Camila Rojas,
 * 12345678-5» valen igual. La primera palabra es el nombre y el resto, el apellido. Las líneas que
 * no se entienden se informan con su número y no se carga ninguna, para no dejar la lista a medias.
 */
export function leerLista(texto: string): { personas: PersonaDeLista[]; errores: string[] } {
  const personas: PersonaDeLista[] = [];
  const errores: string[] = [];
  const lineas = texto.split(/\r?\n/);
  for (const [indice, linea] of lineas.entries()) {
    if (!linea.trim()) continue;
    const numero = indice + 1;
    const encontrado = PATRON_RUT.exec(linea);
    const documento = encontrado ? normalizarRut(encontrado[0]) : null;
    if (!documento) {
      errores.push(`Línea ${numero}: falta un RUT válido`);
      continue;
    }
    const palabras = linea
      .replace(encontrado![0], ' ')
      // Viñetas, numeración («1.», «2)») y separadores de un mensaje copiado.
      .replace(/^\s*(\d+[.)-]|[-•*])\s*/, '')
      .replace(/\brut\b/gi, ' ')
      .replace(/[,;:\t|]/g, ' ')
      .split(/\s+/)
      .filter((palabra) => /\p{L}/u.test(palabra));
    if (palabras.length < 2) {
      errores.push(`Línea ${numero}: falta el nombre o el apellido`);
      continue;
    }
    if (personas.some((persona) => persona.documento === documento)) {
      errores.push(`Línea ${numero}: el RUT ${documento} está repetido`);
      continue;
    }
    const [nombre, ...apellido] = palabras;
    personas.push({
      documento,
      nombre: nombre!.slice(0, 60),
      apellido: apellido.join(' ').slice(0, 60),
    });
  }
  if (personas.length + errores.length === 0) errores.push('Pega al menos una persona');
  if (personas.length > 200) errores.push('Pega hasta 200 personas a la vez');
  return { personas, errores };
}

/**
 * Orden de la noche para una hora («HH:MM»): lo que pasa después de medianoche va después de lo de
 * la tarde. Sin hora, al final.
 */
export function ordenNocturno(hora: string | null): number {
  if (!hora) return Number.MAX_SAFE_INTEGER;
  const [horas, minutos] = hora.split(':').map(Number);
  const desdeMediodia = (horas! + 12) % 24;
  return desdeMediodia * 60 + minutos!;
}
