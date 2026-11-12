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

/** HU-25 CA1: el saldo completo, una fracción o un monto libre. */
export type FormaDelMonto = 'saldo' | 'libre' | 2 | 3 | 4;
export const DIVISIONES = [2, 3, 4] as const;

/** CU-18 paso 2: sin propina, 10 %, 15 % o un monto. */
export type FormaDePropina = 'sin' | 10 | 15 | 'monto';

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
}

/** Personas que faltan por pagar en la división elegida; 1 si se cobra el saldo o un monto. */
export const personasQueFaltan = ({ forma, pagadas }: Pick<FormaDelCobro, 'forma' | 'pagadas'>) =>
  typeof forma === 'number' ? Math.max(1, forma - pagadas) : 1;

export function montoACobrar(cobro: FormaDelCobro, saldo: number): number {
  if (cobro.forma === 'saldo') return Math.max(0, saldo);
  if (cobro.forma === 'libre') return Number(cobro.libre || 0);
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
