// Nota para el equipo con promociones predeterminadas (pedido del Product Owner, 18 nov): cover,
// entrada 2x1, mujeres gratis y todos gratis, cada una hasta una hora, más otra nota libre. Se
// guarda como el texto que lee el equipo («Cover hasta las 01:00 · Llegar a las 21:30») y al
// editarla se reconoce de vuelta. Lógica pura.

export const PROMOCIONES = [
  { clave: 'cover', texto: 'Cover hasta las', hora: '01:00' },
  { clave: 'dosPorUno', texto: 'Entrada 2x1 hasta las', hora: '00:30' },
  { clave: 'mujeres', texto: 'Mujeres gratis hasta las', hora: '00:30' },
  { clave: 'todos', texto: 'Todos gratis hasta las', hora: '23:30' },
] as const;

export type Promocion = (typeof PROMOCIONES)[number]['clave'];

export interface NotaArmada {
  /** Las promociones elegidas, cada una con su hora («01:00»). */
  promociones: Partial<Record<Promocion, string>>;
  /** Lo demás que se escribió. */
  otra: string;
}

const SEPARADOR = ' · ';
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** El texto de la nota: las promociones en su orden y después la nota libre. */
export function componerNota({ promociones, otra }: NotaArmada): string {
  const partes: string[] = PROMOCIONES.flatMap(({ clave, texto }) => {
    const hora = promociones[clave];
    return hora && HORA.test(hora) ? [`${texto} ${hora}`] : [];
  });
  const libre = otra.trim();
  if (libre) partes.push(libre);
  return partes.join(SEPARADOR);
}

/** Reconoce en una nota guardada las promociones; lo que no lo es queda como nota libre. */
export function leerNota(texto: string | null | undefined): NotaArmada {
  const promociones: NotaArmada['promociones'] = {};
  const otras: string[] = [];
  for (const parte of (texto ?? '').split(SEPARADOR)) {
    const promocion = PROMOCIONES.find(
      ({ texto: inicio, clave }) =>
        parte.startsWith(`${inicio} `) &&
        HORA.test(parte.slice(inicio.length + 1)) &&
        promociones[clave] === undefined,
    );
    if (promocion) promociones[promocion.clave] = parte.slice(promocion.texto.length + 1);
    else if (parte.trim()) otras.push(parte.trim());
  }
  return { promociones, otra: otras.join(SEPARADOR) };
}
