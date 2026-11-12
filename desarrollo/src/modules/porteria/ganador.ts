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
