// HU-33: lo que trae a una persona a la puerta una noche. Puede venir invitada por alguien y, a la
// vez, en una o más listas vigentes (una clienta frecuente que va al cumpleaños de una amiga).
// Lógica pura, sin base.

export interface Reconocimiento {
  nombre: string;
  apellido: string;
  gratis: boolean;
  /** Quién la invitó, si es una invitación individual de esta noche. */
  invitadoPor: string | null;
  /** La lista en que viene; `null` si es una invitación individual. */
  listaId: number | null;
  lista: string | null;
  responsable: string | null;
  /** Cuántas noches dura la lista; `null` si no tiene término o si es una invitación. */
  noches: number | null;
}

/**
 * Lo que la puerta muestra: primero lo que la deja entrar gratis. Entre iguales, la invitación de
 * esta noche y después la lista más acotada: el cumpleaños de esta noche antes que la lista sin
 * término de los clientes frecuentes.
 */
export function elegirReconocimiento(candidatos: Reconocimiento[]): Reconocimiento | undefined {
  const orden = (r: Reconocimiento) =>
    [r.gratis ? 0 : 1, r.listaId === null ? 0 : 1, r.noches ?? Number.MAX_SAFE_INTEGER] as const;
  return candidatos.toSorted((a, b) => {
    const [x, y] = [orden(a), orden(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
    return (a.lista ?? '').localeCompare(b.lista ?? '', 'es');
  })[0];
}
