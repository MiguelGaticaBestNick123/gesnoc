// Cola de una estación (HU-17, HU-18). Lógica pura: recibe las filas de la base y decide qué se
// muestra y en qué orden. Los tiempos vienen en segundos medidos con el reloj del servidor, así que
// un teléfono con la hora mal puesta no pinta atrasada una comanda recién llegada.

export type TipoEstacion = 'barra' | 'cocina';

export interface FilaComanda {
  pedido: number;
  personas: number | null;
  /** Segundos desde que se envió el pedido. */
  espera: number;
  /** Segundos desde que la estación la marcó lista; nulo mientras se prepara. */
  listaHace: number | null;
  mesa: number | null;
  referencia: string | null;
  ambiente: string;
  garzon: string;
}

export interface FilaLinea {
  pedido: number;
  linea: number;
  producto: string;
  cantidad: number;
  nota: string | null;
  /** Segundos desde que se anuló; nulo si sigue vigente. */
  anuladaHace: number | null;
}

export interface LineaEnCola {
  linea: number;
  producto: string;
  cantidad: number;
  nota: string | null;
  anulada: boolean;
}

export interface ComandaEnCola {
  pedido: number;
  personas: number | null;
  espera: number;
  listaHace: number | null;
  /** «Mesa 4» o la referencia del cliente de pie. */
  ubicacion: string;
  ambiente: string;
  garzon: string;
  /** Todas sus líneas se anularon: se ve tachada un rato y no se prepara. */
  anulada: boolean;
  lineas: LineaEnCola[];
}

export interface Cola {
  pendientes: ComandaEnCola[];
  listas: ComandaEnCola[];
}

export type NivelDeEspera = 'normal' | 'atrasada' | 'critica';

const MINUTO = 60;
/** HU-17 CA2: se destaca pasados 10 minutos y cambia de color pasados 20. */
export const MINUTOS_ATRASADA = 10;
export const MINUTOS_CRITICA = 20;
/** Una comanda anulada completa se ve tachada 5 minutos y después sale de la cola. */
export const SEGUNDOS_ANULADA_VISIBLE = 5 * MINUTO;

export function nivelDeEspera(segundos: number): NivelDeEspera {
  if (segundos > MINUTOS_CRITICA * MINUTO) return 'critica';
  if (segundos > MINUTOS_ATRASADA * MINUTO) return 'atrasada';
  return 'normal';
}

export const minutos = (segundos: number) => Math.floor(segundos / MINUTO);

export function armarCola(comandas: FilaComanda[], lineas: FilaLinea[]): Cola {
  const lineasDe = new Map<number, FilaLinea[]>();
  for (const linea of lineas) {
    lineasDe.set(linea.pedido, [...(lineasDe.get(linea.pedido) ?? []), linea]);
  }

  const visibles: ComandaEnCola[] = [];
  for (const { mesa, referencia, ...comanda } of comandas) {
    const propias = (lineasDe.get(comanda.pedido) ?? []).sort((a, b) => a.linea - b.linea);
    // Un pedido que llegó entre las dos consultas aparece completo en la siguiente.
    if (propias.length === 0) continue;
    const anulada = propias.every((l) => l.anuladaHace !== null);
    const ultimaAnulacion = Math.min(...propias.map((l) => l.anuladaHace ?? Infinity));
    if (anulada && ultimaAnulacion > SEGUNDOS_ANULADA_VISIBLE) continue;

    visibles.push({
      ...comanda,
      ubicacion: mesa === null ? (referencia ?? 'Sin mesa') : `Mesa ${mesa}`,
      anulada,
      lineas: propias.map(({ linea, producto, cantidad, nota, anuladaHace }) => ({
        linea,
        producto,
        cantidad,
        nota,
        anulada: anuladaHace !== null,
      })),
    });
  }

  return {
    // En orden de llegada: primero lo más antiguo (HU-17).
    pendientes: visibles
      .filter((c) => c.listaHace === null)
      .sort((a, b) => b.espera - a.espera || a.pedido - b.pedido),
    // Listas para retirar: arriba la más reciente.
    listas: visibles
      .filter((c) => c.listaHace !== null)
      .sort((a, b) => (a.listaHace ?? 0) - (b.listaHace ?? 0) || a.pedido - b.pedido),
  };
}

/** Lo que no estaba en la consulta anterior: hace sonar el aviso de comanda nueva o lista. */
export function nuevos<T>(anteriores: readonly T[], actuales: readonly T[]): T[] {
  const vistos = new Set(anteriores);
  return actuales.filter((elemento) => !vistos.has(elemento));
}
