import { ingresosDeLaNoche } from '@/modules/porteria/servicios/puerta';
import { operar } from '@/shared/rutas';

// HU-32: quiénes entraron esta noche, para todos los teléfonos de la puerta (RNF-05).
export async function GET() {
  return operar((actor) => ingresosDeLaNoche(actor));
}
