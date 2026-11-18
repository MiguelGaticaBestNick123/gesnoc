// Lógica pura del cobro (HU-24 y HU-25). El monto de cada pago sale del saldo que entrega el
// servidor; la propina se suma aparte y no descuenta del saldo (ADR-011).

import { formatearPesos } from '@/shared/utilidades/dinero';
import type { MedioDePago } from './cuenta';

export const MEDIOS: readonly { valor: MedioDePago; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
];

export const nombreDelMedio = (medio: MedioDePago) =>
  MEDIOS.find((m) => m.valor === medio)?.etiqueta ?? medio;

/** En Chile ya no circulan monedas de $1 ni de $5: las partes y las propinas van a la decena. */
const DECENA = 10;

/**
 * HU-25 CA1: el saldo completo, una fracción, un monto libre o la suma de los ítems que alguien paga
 * («yo pago mis dos piscolas»).
 */
export type FormaDelMonto = 'saldo' | 'libre' | 'items' | 2 | 3 | 4;
export const DIVISIONES = [2, 3, 4] as const;

/** CU-18 paso 2: sin propina, 10 %, 15 %, 30 % o un monto. */
export type FormaDePropina = 'sin' | 10 | 15 | 30 | 'monto';

/**
 * La parte de cada persona cuando el saldo se divide entre las que aún no pagan. Se redondea hacia
 * arriba a la decena y nunca supera el saldo: así la última parte es exactamente lo que queda y la
 * suma de los pagos calza con el total (decisión 9 del plan del bloque 2). Dividir el total, como
 * hacía el sistema anterior, deja $1 colgando: 3 × $3.333 no cubren $10.000.
 */
export function partePorPersona(saldo: number, personas: number): number {
  if (saldo <= 0) return 0;
  if (personas <= 1) return saldo;
  return Math.min(saldo, Math.ceil(saldo / personas / DECENA) * DECENA);
}

export interface FormaDelCobro {
  forma: FormaDelMonto;
  /** Partes de la división que ya se pagaron en esta pantalla. */
  pagadas: number;
  /** Dígitos del monto libre. */
  libre: string;
  /** Lo que suman los ítems elegidos, si se cobra por ítems. */
  porItems?: number;
}

/**
 * CU-18 paso 1 (incluye CU-15): lo consumido en la cuenta, para responder «¿qué me están cobrando?»
 * sin salir del cobro. Sin lo anulado, y con el mismo producto al mismo precio en una sola línea.
 */
export function consumoDeLaCuenta(
  pedidos: readonly {
    lineas: readonly {
      producto: string;
      cantidad: number;
      precioUnitario: number;
      anulada: unknown;
    }[];
  }[],
) {
  const porProducto = new Map<string, { producto: string; cantidad: number; importe: number }>();
  for (const linea of pedidos.flatMap((pedido) => pedido.lineas)) {
    if (linea.anulada) continue;
    const clave = `${linea.producto}|${linea.precioUnitario}`;
    const previo = porProducto.get(clave) ?? { producto: linea.producto, cantidad: 0, importe: 0 };
    porProducto.set(clave, {
      ...previo,
      cantidad: previo.cantidad + linea.cantidad,
      importe: previo.importe + linea.cantidad * linea.precioUnitario,
    });
  }
  return [...porProducto].map(([clave, linea]) => ({ clave, ...linea }));
}

/**
 * Cobro por ítems: lo que suman las unidades elegidas de cada línea. Lo ya pagado no queda marcado
 * por ítem (el modelo registra montos), así que el tope sigue siendo el saldo.
 */
export function montoDeItems(
  lineas: readonly { clave: string; precioUnitario: number; cantidad: number }[],
  elegidas: Readonly<Record<string, number>>,
): number {
  return lineas.reduce(
    (suma, linea) =>
      suma +
      linea.precioUnitario * Math.min(linea.cantidad, Math.max(0, elegidas[linea.clave] ?? 0)),
    0,
  );
}

/** Personas que faltan por pagar en la división elegida; 1 si se cobra el saldo o un monto. */
export const personasQueFaltan = ({ forma, pagadas }: Pick<FormaDelCobro, 'forma' | 'pagadas'>) =>
  typeof forma === 'number' ? Math.max(1, forma - pagadas) : 1;

export function montoACobrar(cobro: FormaDelCobro, saldo: number): number {
  if (cobro.forma === 'saldo') return Math.max(0, saldo);
  if (cobro.forma === 'libre') return Number(cobro.libre || 0);
  if (cobro.forma === 'items') return Math.min(Math.max(0, saldo), cobro.porItems ?? 0);
  return partePorPersona(saldo, personasQueFaltan(cobro));
}

export function propinaDe(forma: FormaDePropina, digitos: string, monto: number): number {
  if (forma === 'sin') return 0;
  if (forma === 'monto') return Number(digitos || 0);
  return Math.round((monto * forma) / 100 / DECENA) * DECENA;
}

/** Lo que impide cobrar, en palabras del garzón; nulo si se puede. */
export function problemaDelCobro(
  monto: number,
  saldo: number,
  medio: MedioDePago | null,
): string | null {
  if (saldo <= 0) return 'La cuenta no tiene saldo por cobrar.';
  if (monto <= 0) return 'Escribe el monto que paga.';
  if (monto > saldo) return `El monto supera el saldo de ${formatearPesos(saldo)}.`; // RN-18
  if (!medio) return 'Elige el medio de pago.';
  return null;
}

// Un cobro que no se pudo confirmar (CU-18 4c) se guarda en el teléfono con su clave de envío, igual
// que el borrador del pedido: si la pantalla se recarga, el reintento lleva la misma clave y el
// servidor devuelve el pago ya registrado en vez de cobrarlo dos veces (RN-13).

export interface CobroPendiente {
  clave: string;
  medio: MedioDePago;
  monto: number;
  propina: number;
}

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const PREFIJO = 'gesnoc:cobro:';

export const llaveDeCobro = (fecha: string, cuenta: number) => `${PREFIJO}${fecha}:${cuenta}`;

const esPendiente = (valor: unknown): valor is CobroPendiente => {
  const cobro = valor as CobroPendiente;
  return (
    typeof cobro?.clave === 'string' &&
    MEDIOS.some((m) => m.valor === cobro.medio) &&
    Number.isSafeInteger(cobro.monto) &&
    cobro.monto > 0 &&
    Number.isSafeInteger(cobro.propina) &&
    cobro.propina >= 0
  );
};

export function leerCobroPendiente(
  almacen: Almacen,
  fecha: string,
  cuenta: number,
): CobroPendiente | null {
  try {
    const deOtraNoche: string[] = [];
    for (let indice = 0; indice < almacen.length; indice++) {
      const otra = almacen.key(indice);
      if (otra?.startsWith(PREFIJO) && !otra.startsWith(`${PREFIJO}${fecha}:`))
        deOtraNoche.push(otra);
    }
    deOtraNoche.forEach((otra) => almacen.removeItem(otra));

    const guardado: unknown = JSON.parse(almacen.getItem(llaveDeCobro(fecha, cuenta)) ?? 'null');
    return esPendiente(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

export function guardarCobroPendiente(
  almacen: Almacen,
  fecha: string,
  cuenta: number,
  cobro: CobroPendiente | null,
) {
  try {
    const llave = llaveDeCobro(fecha, cuenta);
    if (cobro) almacen.setItem(llave, JSON.stringify(cobro));
    else almacen.removeItem(llave);
  } catch {
    // Sin almacenamiento (modo privado): el cobro pendiente vive mientras la pantalla esté abierta.
  }
}
