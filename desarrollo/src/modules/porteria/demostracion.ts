// Entradas de una noche de demostración: solo las pagadas llevan ticket (RN-22).

export interface Entrada {
  hora: string;
  ticket: number | null;
  monto: number;
  medioPago: 'efectivo' | 'tarjeta' | 'transferencia' | null;
}

export const entradasNoche: Entrada[] = [
  { hora: '22:41', ticket: 18, monto: 5000, medioPago: 'tarjeta' },
  { hora: '22:38', ticket: null, monto: 0, medioPago: null },
  { hora: '22:35', ticket: 17, monto: 5000, medioPago: 'efectivo' },
  { hora: '22:31', ticket: 16, monto: 5000, medioPago: 'transferencia' },
];

export const recaudado = (entradas: Entrada[]): number =>
  entradas.reduce((suma, e) => suma + e.monto, 0);
