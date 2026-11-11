import type { NextRequest } from 'next/server';
import { detalleCuenta } from '@/modules/venta/servicios/cuentas';
import { ErrorDeNegocio } from '@/shared/errores';
import { operar } from '@/shared/rutas';

// HU-23: el detalle de una cuenta, al día cada pocos segundos (estado de cada comanda y pagos).
export async function GET(peticion: NextRequest) {
  const numero = Number(peticion.nextUrl.searchParams.get('numero'));
  return operar(async (actor) => {
    const detalle = await detalleCuenta(actor, numero);
    if (!detalle) throw new ErrorDeNegocio('Esa cuenta no existe');
    return detalle;
  });
}
