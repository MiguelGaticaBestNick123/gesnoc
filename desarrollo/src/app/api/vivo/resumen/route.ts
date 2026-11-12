import { resumenDeLaNoche } from '@/modules/venta/servicios/resumen';
import { operar } from '@/shared/rutas';

// Portada de la administración: las cifras de la noche, que se consultan cada pocos segundos.
export async function GET() {
  return operar((actor) => resumenDeLaNoche(actor));
}
