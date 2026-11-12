// Cómo se anota cada entrada en la puerta del local (pedido del Product Owner, 12 nov): EF si paga en
// efectivo, RC si paga con tarjeta, PN si queda pendiente (suele ser un invitado o un cliente
// frecuente que le paga después a la administración) y gratis, que no lleva ticket (RN-22).

export const MEDIOS_DE_ENTRADA = ['efectivo', 'tarjeta', 'pendiente'] as const;
export type MedioDeEntrada = (typeof MEDIOS_DE_ENTRADA)[number];

export const FORMAS_DE_ENTRADA = [...MEDIOS_DE_ENTRADA, 'gratis'] as const;
export type FormaDeEntrada = (typeof FORMAS_DE_ENTRADA)[number];

interface Forma {
  codigo: string;
  nombre: string;
  color: string;
  detalle: string;
}

export const formas: Record<FormaDeEntrada, Forma> = {
  efectivo: { codigo: 'EF', nombre: 'Efectivo', color: 'green', detalle: 'Paga en efectivo' },
  tarjeta: { codigo: 'RC', nombre: 'Tarjeta', color: 'blue', detalle: 'Paga con tarjeta' },
  pendiente: {
    codigo: 'PN',
    nombre: 'Pendiente',
    color: 'orange',
    detalle: 'Paga después a la administración',
  },
  gratis: { codigo: 'Gratis', nombre: 'Gratis', color: 'gray', detalle: 'Entra sin ticket' },
};

/** La forma de una entrada registrada: sin medio de pago, entró gratis. */
export const formaDe = (medio: string | null): FormaDeEntrada =>
  (MEDIOS_DE_ENTRADA as readonly string[]).includes(medio ?? '')
    ? (medio as MedioDeEntrada)
    : 'gratis';
