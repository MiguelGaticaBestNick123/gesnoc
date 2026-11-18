/** Fuente de azar: un entero entre 0 y `maximo` (excluido), como `crypto.randomInt`. */
export type Azar = (maximo: number) => number;

/**
 * Elige el ticket ganador entre los que participan (RN-23). La fuente de azar se recibe para poder
 * probar la regla sin azar; en el servidor es `crypto.randomInt`, no `Math.random`.
 */
export function elegirGanador(tickets: number[], azar: Azar): number {
  if (tickets.length === 0) throw new Error('No hay tickets para sortear');
  return tickets[azar(tickets.length)]!;
}

/**
 * Cómo se proyecta al ganador en el local: el nombre y la inicial del apellido («Camila R.»). Basta
 * para que se reconozca sin exponer sus datos a todo el local (RN-25); la ficha completa la ve el
 * guardia en su pantalla.
 */
export function nombrePublico(nombre: string, apellido: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? '';
  const inicial = apellido.trim().charAt(0).toLocaleUpperCase('es-CL');
  return inicial ? `${primero} ${inicial}.` : primero;
}
