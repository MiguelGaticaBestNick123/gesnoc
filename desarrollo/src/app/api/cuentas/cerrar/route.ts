import { conCuenta } from '@/modules/venta/esquemas';
import { cerrarSinConsumo } from '@/modules/venta/servicios/cuentas';
import { leerJson, operar } from '@/shared/rutas';

// Cerrar una cuenta abierta por error, sin consumo ni pagos.
export async function POST(peticion: Request) {
  return operar(async (actor) => {
    const { cuenta } = conCuenta.parse(await leerJson(peticion));
    await cerrarSinConsumo(actor, cuenta);
    return { cerrada: cuenta };
  });
}
