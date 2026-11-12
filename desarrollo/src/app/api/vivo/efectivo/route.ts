import { miEfectivo } from '@/modules/venta/servicios/pagos';
import { operar } from '@/shared/rutas';

// CU-18 paso 6: el efectivo del garzón por entregar; sale de la lista cuando la administración lo
// confirma (HU-26).
export async function GET() {
  return operar((actor) => miEfectivo(actor));
}
