// Recomendación al asignar turnos (pedido del Product Owner, 12 nov): el rol se decide cada noche y
// una persona puede ser guardia un día y garzón otro, pero cada una suele tener un rol habitual. Al
// asignar un rol se muestran todas las personas, con las habituales primero y destacadas. Desde el
// 18 nov la administración define el rol habitual y uno alternativo de cada persona; si no los
// definió, el habitual sale del historial de turnos.
import type { RolTurno } from '@/shared/autorizacion';

export interface VecesEnRol {
  rol: RolTurno;
  veces: number;
  /** Fecha de la última noche en ese rol. */
  ultima: string;
}

/** El rol más repetido; si empatan, el más reciente. Sin historial, nulo. */
export function rolPrincipal(historial: VecesEnRol[]): RolTurno | null {
  const mejor = [...historial].sort(
    (a, b) => b.veces - a.veces || b.ultima.localeCompare(a.ultima),
  )[0];
  return mejor?.rol ?? null;
}

interface Candidata {
  nombre: string;
  principal: RolTurno | null;
  /** Otro rol que también suele hacer (Matías: barra y garzón). */
  alternativo?: RolTurno | null;
  disponible: boolean;
  rol: RolTurno | null;
  veces: Partial<Record<RolTurno, number>>;
}

/** Si la persona suele hacer ese rol, como habitual o como alternativo. */
export const sueleHacer = (persona: Candidata, rol: RolTurno) =>
  persona.principal === rol || persona.alternativo === rol;

/**
 * Personas para asignar un rol: arriba las que lo hacen habitualmente, primero las que lo tienen
 * como rol principal y después como alternativo; luego el resto. En cada grupo van primero quienes
 * postularon a la noche, después las que más veces lo han hecho.
 */
export function ordenarParaRol<T extends Candidata>(personas: T[], rol: RolTurno) {
  const orden = (a: T, b: T) =>
    Number(b.principal === rol) - Number(a.principal === rol) ||
    Number(b.disponible) - Number(a.disponible) ||
    Number(b.rol === rol) - Number(a.rol === rol) ||
    (b.veces[rol] ?? 0) - (a.veces[rol] ?? 0) ||
    a.nombre.localeCompare(b.nombre, 'es');
  return {
    habituales: personas.filter((p) => sueleHacer(p, rol)).sort(orden),
    otras: personas.filter((p) => !sueleHacer(p, rol)).sort(orden),
  };
}
