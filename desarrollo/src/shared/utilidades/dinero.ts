const formato = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** Muestra un monto en pesos chilenos. El dinero se maneja siempre en pesos enteros. */
export function formatearPesos(monto: number): string {
  if (!Number.isSafeInteger(monto)) {
    throw new RangeError(`El monto debe ser un entero de pesos: ${monto}`);
  }
  return formato.format(monto);
}
