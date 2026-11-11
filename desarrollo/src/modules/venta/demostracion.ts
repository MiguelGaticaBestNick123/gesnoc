// Cuentas abiertas de una noche de demostración. Cada pedido se divide en comandas
// por estación, igual que en el modelo: una línea va a la barra del ambiente o a la cocina.

export type EstadoComanda = 'pendiente' | 'lista' | 'entregada';

export interface LineaPedido {
  linea: number;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  estacion: string;
}

export interface Comanda {
  estacion: string;
  estado: EstadoComanda;
}

export interface Pedido {
  numero: number;
  enviadoEn: string;
  lineas: LineaPedido[];
  comandas: Comanda[];
}

export interface Cuenta {
  numero: number;
  mesaId: number | null;
  ambienteId: number;
  referencia: string | null;
  abiertaEn: string;
  garzon: string;
  pedidos: Pedido[];
  pagado: number;
}

export const cuentasAbiertas: Cuenta[] = [
  {
    numero: 12,
    mesaId: 4,
    ambienteId: 1,
    referencia: null,
    abiertaEn: '21:12',
    garzon: 'Camila',
    pagado: 0,
    pedidos: [
      {
        numero: 57,
        enviadoEn: '21:15',
        lineas: [
          {
            linea: 1,
            producto: 'Pisco sour',
            cantidad: 2,
            precioUnitario: 6500,
            estacion: 'Barra Salón',
          },
          {
            linea: 2,
            producto: 'Tabla mixta',
            cantidad: 1,
            precioUnitario: 14900,
            estacion: 'Cocina',
          },
        ],
        comandas: [
          { estacion: 'Barra Salón', estado: 'entregada' },
          { estacion: 'Cocina', estado: 'lista' },
        ],
      },
      {
        numero: 61,
        enviadoEn: '21:48',
        lineas: [
          {
            linea: 1,
            producto: 'Agua mineral',
            cantidad: 1,
            precioUnitario: 1500,
            estacion: 'Barra Salón',
          },
        ],
        comandas: [{ estacion: 'Barra Salón', estado: 'pendiente' }],
      },
    ],
  },
  {
    numero: 14,
    mesaId: 8,
    ambienteId: 1,
    referencia: null,
    abiertaEn: '21:40',
    garzon: 'Camila',
    pagado: 0,
    pedidos: [
      {
        numero: 60,
        enviadoEn: '21:44',
        lineas: [
          {
            linea: 1,
            producto: 'Cerveza artesanal',
            cantidad: 3,
            precioUnitario: 4500,
            estacion: 'Barra Salón',
          },
        ],
        comandas: [{ estacion: 'Barra Salón', estado: 'pendiente' }],
      },
    ],
  },
  {
    numero: 15,
    mesaId: 11,
    ambienteId: 1,
    referencia: null,
    abiertaEn: '21:55',
    garzon: 'Diego',
    pagado: 12000,
    pedidos: [
      {
        numero: 62,
        enviadoEn: '21:58',
        lineas: [
          {
            linea: 1,
            producto: 'Mojito',
            cantidad: 2,
            precioUnitario: 6000,
            estacion: 'Barra Salón',
          },
          {
            linea: 2,
            producto: 'Papas fritas',
            cantidad: 1,
            precioUnitario: 5500,
            estacion: 'Cocina',
          },
        ],
        comandas: [
          { estacion: 'Barra Salón', estado: 'lista' },
          { estacion: 'Cocina', estado: 'pendiente' },
        ],
      },
    ],
  },
  {
    numero: 16,
    mesaId: null,
    ambienteId: 2,
    referencia: 'Polera roja, junto a la barra',
    abiertaEn: '22:05',
    garzon: 'Diego',
    pagado: 0,
    pedidos: [
      {
        numero: 63,
        enviadoEn: '22:06',
        lineas: [
          {
            linea: 1,
            producto: 'Piscola',
            cantidad: 2,
            precioUnitario: 5000,
            estacion: 'Barra Terraza',
          },
        ],
        comandas: [{ estacion: 'Barra Terraza', estado: 'lista' }],
      },
    ],
  },
];

export function totalCuenta(cuenta: Cuenta): number {
  return cuenta.pedidos
    .flatMap((p) => p.lineas)
    .reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
}

export function saldoCuenta(cuenta: Cuenta): number {
  return totalCuenta(cuenta) - cuenta.pagado;
}
