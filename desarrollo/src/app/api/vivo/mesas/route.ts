import type { NextRequest } from 'next/server';
import { mapa } from '@/modules/venta/servicios/cuentas';
import { operar } from '@/shared/rutas';

// Estado del mapa de un ambiente, que cada teléfono consulta cada pocos segundos (HU-13, RNF-05).
export async function GET(peticion: NextRequest) {
  const ambiente = Number(peticion.nextUrl.searchParams.get('ambiente')) || undefined;
  return operar((actor) => mapa(actor, ambiente));
}
