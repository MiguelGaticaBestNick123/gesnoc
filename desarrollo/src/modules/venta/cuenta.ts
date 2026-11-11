// Lógica pura del detalle de una cuenta (HU-23) y de las comandas de un garzón (HU-20). El total, lo
// pagado y el saldo no se guardan en ninguna tabla: se derivan de las líneas vigentes y los pagos
// (ADR-011), así una anulación nunca deja un total desactualizado.

export type MedioDePago = 'efectivo' | 'tarjeta' | 'transferencia';
export type EstadoComanda = 'en preparación' | 'lista' | 'entregada';

export interface FilaDetalle {
  pedido: number;
  enviadoEn: string;
  tomadoPor: string;
  linea: number;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  nota: string | null;
  estacion: string;
  lista: boolean;
  entregada: boolean;
  anuladoEn: string | null;
  anuladoPor: string | null;
}

export interface PagoDeCuenta {
  numero: number;
  medio: MedioDePago;
  monto: number;
  propina: number;
  registradoEn: string;
  registradoPor: string;
  confirmado: boolean;
}

export interface LineaDeCuenta {
  linea: number;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  nota: string | null;
  estacion: string;
  estado: EstadoComanda;
  anulada: { en: string; por: string } | null;
}

export interface PedidoDeCuenta {
  numero: number;
  enviadoEn: string;
  tomadoPor: string;
  lineas: LineaDeCuenta[];
}

export const estadoDe = (lista: boolean, entregada: boolean): EstadoComanda =>
  entregada ? 'entregada' : lista ? 'lista' : 'en preparación';

const importe = (linea: { cantidad: number; precioUnitario: number }) =>
  linea.cantidad * linea.precioUnitario;

/** HU-23: los anulados no suman (CA2); la propina no descuenta del saldo, solo el monto del pago. */
export function resumenCuenta(
  lineas: { cantidad: number; precioUnitario: number; anuladoEn: string | null }[],
  pagos: { monto: number }[],
) {
  const total = lineas.filter((l) => l.anuladoEn === null).reduce((s, l) => s + importe(l), 0);
  const pagado = pagos.reduce((suma, pago) => suma + pago.monto, 0);
  return { total, pagado, saldo: total - pagado };
}

/** Las líneas agrupadas por pedido, en el orden en que se enviaron. */
export function agruparPedidos(filas: FilaDetalle[]): PedidoDeCuenta[] {
  const pedidos = new Map<number, PedidoDeCuenta>();
  const ordenadas = [...filas].sort((a, b) => a.pedido - b.pedido || a.linea - b.linea);
  for (const fila of ordenadas) {
    let pedido = pedidos.get(fila.pedido);
    if (!pedido) {
      pedido = {
        numero: fila.pedido,
        enviadoEn: fila.enviadoEn,
        tomadoPor: fila.tomadoPor,
        lineas: [],
      };
      pedidos.set(fila.pedido, pedido);
    }
    pedido.lineas.push({
      linea: fila.linea,
      producto: fila.producto,
      cantidad: fila.cantidad,
      precioUnitario: fila.precioUnitario,
      nota: fila.nota,
      estacion: fila.estacion,
      estado: estadoDe(fila.lista, fila.entregada),
      anulada: fila.anuladoEn === null ? null : { en: fila.anuladoEn, por: fila.anuladoPor ?? '' },
    });
  }
  return [...pedidos.values()];
}

export interface FilaMiComanda {
  pedido: number;
  estacionId: number;
  estacion: string;
  cuenta: number;
  mesa: number | null;
  referencia: string | null;
  /** Lo que hay que retirar, por ejemplo «2 × Mojito, 1 × Piscola». */
  resumen: string;
  espera: number;
  listaHace: number | null;
}

export interface MiComanda extends Omit<FilaMiComanda, 'mesa' | 'referencia'> {
  /** «Mesa 4» o la referencia del cliente de pie (HU-20 CA2). */
  ubicacion: string;
}

export const claveDeComanda = (comanda: { pedido: number; estacionId: number }) =>
  `${comanda.pedido}-${comanda.estacionId}`;

/** HU-20: arriba las listas que llevan más tiempo esperando que el garzón las retire. */
export function ordenarMisComandas(filas: FilaMiComanda[]) {
  const comandas = filas.map(({ mesa, referencia, ...fila }): MiComanda => ({
    ...fila,
    ubicacion: mesa === null ? (referencia ?? 'Sin mesa') : `Mesa ${mesa}`,
  }));
  return {
    listas: comandas
      .filter((c) => c.listaHace !== null)
      .sort((a, b) => (b.listaHace ?? 0) - (a.listaHace ?? 0) || a.pedido - b.pedido),
    enPreparacion: comandas
      .filter((c) => c.listaHace === null)
      .sort((a, b) => b.espera - a.espera || a.pedido - b.pedido),
  };
}
