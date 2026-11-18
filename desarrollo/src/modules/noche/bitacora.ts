// Lógica pura de la bitácora de la noche: convierte cada evento registrado en una línea legible.
import { formatearPesos } from '@/shared/utilidades/dinero';

export type TipoEvento =
  | 'noche_abierta'
  | 'noche_cerrada'
  | 'cuenta_abierta'
  | 'cuenta_cerrada'
  | 'pedido'
  | 'anulacion'
  | 'lista'
  | 'entregada'
  | 'pago'
  | 'efectivo_confirmado'
  | 'entrada'
  | 'reporte'
  | 'llamado'
  | 'llamado_atendido'
  | 'sorteo';

export type Categoria = 'noche' | 'pedidos' | 'cobros' | 'puerta' | 'llamados';

export interface Evento {
  tipo: TipoEvento;
  /** Marca de tiempo de la base («2026-11-07 23:15:02+00»). */
  marca: string;
  /** Quién lo hizo; `null` si el evento no guarda autor (el cliente que llama, la estación). */
  actor: string | null;
  datos: Record<string, string | number | null>;
}

export const categorias: Record<Categoria, string> = {
  noche: 'Noche',
  pedidos: 'Pedidos',
  cobros: 'Cobros',
  puerta: 'Puerta',
  llamados: 'Llamados',
};

const categoriaDe: Record<TipoEvento, Categoria> = {
  noche_abierta: 'noche',
  noche_cerrada: 'noche',
  cuenta_abierta: 'pedidos',
  cuenta_cerrada: 'cobros',
  pedido: 'pedidos',
  anulacion: 'pedidos',
  lista: 'pedidos',
  entregada: 'pedidos',
  pago: 'cobros',
  efectivo_confirmado: 'cobros',
  entrada: 'puerta',
  reporte: 'puerta',
  sorteo: 'puerta',
  llamado: 'llamados',
  llamado_atendido: 'llamados',
};

const medios: Record<string, string> = {
  efectivo: 'en efectivo',
  tarjeta: 'con tarjeta',
  transferencia: 'por transferencia',
};

const formas: Record<string, string> = {
  efectivo: 'EF',
  tarjeta: 'RC',
  pendiente: 'PN',
};

const tiposDeReporte: Record<string, string> = {
  advertencia: 'una advertencia',
  expulsion: 'una expulsión',
  observacion: 'una observación',
};

const pesos = (valor: string | number | null | undefined) => formatearPesos(Number(valor ?? 0));

/** El texto de un evento, sin el autor (que se muestra aparte). */
export function describir({ tipo, datos: d }: Pick<Evento, 'tipo' | 'datos'>): string {
  switch (tipo) {
    case 'noche_abierta':
      return 'Se abrió la noche';
    case 'noche_cerrada':
      return 'Se cerró la noche';
    case 'cuenta_abierta':
      return `Abrió la cuenta ${d.cuenta} (${d.ubicacion})`;
    case 'cuenta_cerrada':
      return Number(d.saldo) > 0
        ? `Cerró la cuenta ${d.cuenta} con ${pesos(d.saldo)} sin cobrar`
        : `Se cerró la cuenta ${d.cuenta}, pagada`;
    case 'pedido':
      return `Envió el pedido ${d.pedido} (cuenta ${d.cuenta}): ${d.items} · ${pesos(d.total)}`;
    case 'anulacion':
      return `Anuló ${d.item} del pedido ${d.pedido}`;
    case 'lista':
      return `${d.estacion} marcó listo el pedido ${d.pedido}`;
    case 'entregada':
      return `Se entregó el pedido ${d.pedido} de ${d.estacion}`;
    case 'pago': {
      const propina = Number(d.propina) > 0 ? ` + ${pesos(d.propina)} de propina` : '';
      return `Cobró ${pesos(d.monto)}${propina} ${medios[String(d.medio)] ?? ''} · cuenta ${d.cuenta}`;
    }
    case 'efectivo_confirmado':
      return `Confirmó ${pesos(d.monto)} en efectivo de la cuenta ${d.cuenta}`;
    case 'entrada': {
      const forma = d.medio ? formas[String(d.medio)] : 'gratis';
      const ticket = d.ticket ? ` · ticket ${d.ticket}` : '';
      return `Registró la entrada de ${d.cliente} (${forma ?? d.medio})${ticket}`;
    }
    case 'reporte':
      return `Reportó a ${d.cliente} con ${tiposDeReporte[String(d.tipo)] ?? 'un reporte'}`;
    case 'llamado':
      return `La mesa ${d.mesa} de ${d.ambiente} llamó al garzón`;
    case 'llamado_atendido':
      return `Atendió el llamado de la mesa ${d.mesa} de ${d.ambiente}`;
    case 'sorteo':
      return `Sorteó ${d.premio} en ${d.ambiente}: ganó el ticket ${d.ticket}`;
  }
}

export const categoria = (tipo: TipoEvento): Categoria => categoriaDe[tipo];
