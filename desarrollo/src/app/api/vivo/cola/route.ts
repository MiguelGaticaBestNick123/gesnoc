import type { NextRequest } from 'next/server';
import { tipoEstacion } from '@/modules/venta/esquemas';
import { cola } from '@/modules/venta/servicios/colas';
import { operar } from '@/shared/rutas';

// Cola de una estación, que la barra o la cocina consultan cada pocos segundos (HU-17, RNF-05).
export async function GET(peticion: NextRequest) {
  const parametros = peticion.nextUrl.searchParams;
  return operar((actor) =>
    cola(
      actor,
      tipoEstacion.parse(parametros.get('tipo')),
      Number(parametros.get('estacion')) || undefined,
    ),
  );
}
