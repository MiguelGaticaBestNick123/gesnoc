import { datosAbrirCuenta } from '@/modules/venta/esquemas';
import { abrir } from '@/modules/venta/servicios/cuentas';
import { leerJson, operar } from '@/shared/rutas';

// HU-14: abrir una cuenta en una mesa o para un cliente de pie.
export async function POST(peticion: Request) {
  return operar(async (actor) => abrir(actor, datosAbrirCuenta.parse(await leerJson(peticion))));
}
