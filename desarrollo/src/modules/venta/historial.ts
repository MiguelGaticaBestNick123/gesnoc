// Historial de comandas de la noche (pedido del Product Owner, 18 nov): cada pedido con su hora,
// dónde está el cliente, quién lo tomó y lo que pidió a cada estación, con el estado de cada comanda.
// Lo ven garzón, barra, cocina y administración. Lógica pura: recibe las filas de la base.
import { paraBuscar } from '@/shared/utilidades/buscar';

export interface FilaHistorial {
  pedido: number;
  estacionId: number;
  estacion: string;
  /** Hora en que se envió el pedido, «23:41» en Chile. */
  hora: string;
  /** Hora en que la estación la marcó lista; nula mientras se prepara. */
  lista: string | null;
  /** Hora en que el garzón la entregó; nula mientras no se retira. */
  entregada: string | null;
  personas: number | null;
  mesa: number | null;
  referencia: string | null;
  ambiente: string;
  garzon: string;
}

export interface FilaLineaHistorial {
  pedido: number;
  estacionId: number;
  linea: number;
  producto: string;
  cantidad: number;
  nota: string | null;
  anulada: boolean;
}

export type EstadoComanda = 'pendiente' | 'lista' | 'entregada' | 'anulada';

export interface ComandaDelHistorial {
  estacionId: number;
  estacion: string;
  estado: EstadoComanda;
  lista: string | null;
  entregada: string | null;
  lineas: Omit<FilaLineaHistorial, 'pedido' | 'estacionId'>[];
}

export interface PedidoDelHistorial {
  pedido: number;
  hora: string;
  /** «Mesa 4» o la referencia del cliente de pie. */
  ubicacion: string;
  ambiente: string;
  garzon: string;
  personas: number | null;
  comandas: ComandaDelHistorial[];
}

/** Una comanda anulada completa no se preparó; si no, el estado sale de sus marcas de tiempo. */
export function estadoDe(
  comanda: Pick<FilaHistorial, 'lista' | 'entregada'>,
  lineas: Pick<FilaLineaHistorial, 'anulada'>[],
): EstadoComanda {
  if (lineas.length > 0 && lineas.every((linea) => linea.anulada)) return 'anulada';
  if (comanda.entregada) return 'entregada';
  return comanda.lista ? 'lista' : 'pendiente';
}

/** Los pedidos de la noche, del más reciente al más antiguo, cada uno con sus comandas. */
export function armarHistorial(
  comandas: FilaHistorial[],
  lineas: FilaLineaHistorial[],
): PedidoDelHistorial[] {
  const pedidos = new Map<number, PedidoDelHistorial>();
  for (const fila of comandas) {
    const propias = lineas
      .filter((l) => l.pedido === fila.pedido && l.estacionId === fila.estacionId)
      .sort((a, b) => a.linea - b.linea);
    const pedido = pedidos.get(fila.pedido) ?? {
      pedido: fila.pedido,
      hora: fila.hora,
      ubicacion: fila.mesa === null ? (fila.referencia ?? 'Sin mesa') : `Mesa ${fila.mesa}`,
      ambiente: fila.ambiente,
      garzon: fila.garzon,
      personas: fila.personas,
      comandas: [],
    };
    pedido.comandas.push({
      estacionId: fila.estacionId,
      estacion: fila.estacion,
      estado: estadoDe(fila, propias),
      lista: fila.lista,
      entregada: fila.entregada,
      lineas: propias.map(({ linea, producto, cantidad, nota, anulada }) => ({
        linea,
        producto,
        cantidad,
        nota,
        anulada,
      })),
    });
    pedidos.set(fila.pedido, pedido);
  }
  return [...pedidos.values()]
    .map((pedido) => ({
      ...pedido,
      comandas: pedido.comandas.sort((a, b) => a.estacion.localeCompare(b.estacion, 'es')),
    }))
    .sort((a, b) => b.pedido - a.pedido);
}

/** Lo que se ve con un filtro: los pedidos con alguna comanda de esa estación, solo con ella. */
export function filtrarHistorial(
  pedidos: PedidoDelHistorial[],
  estacionId: number | null,
  texto: string,
): PedidoDelHistorial[] {
  const buscado = paraBuscar(texto.trim());
  return pedidos
    .map((pedido) => ({
      ...pedido,
      comandas:
        estacionId === null
          ? pedido.comandas
          : pedido.comandas.filter((comanda) => comanda.estacionId === estacionId),
    }))
    .filter((pedido) => pedido.comandas.length > 0)
    .filter(
      (pedido) =>
        buscado === '' ||
        paraBuscar(
          [
            `pedido ${pedido.pedido}`,
            pedido.ubicacion,
            pedido.ambiente,
            pedido.garzon,
            ...pedido.comandas.flatMap((c) => c.lineas.map((l) => l.producto)),
          ].join(' '),
        ).includes(buscado),
    );
}
