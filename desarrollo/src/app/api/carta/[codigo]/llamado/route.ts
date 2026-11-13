import { llamar } from '@/modules/venta/servicios/llamados';
import { publico } from '@/shared/rutas';

// HU-39: el botón «Llamar al garzón» de la carta. Ruta pública: el código del QR es la única llave, y
// con un llamado pendiente un nuevo toque recibe la misma confirmación (RN-29).
export async function POST(_: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return publico(() => llamar(codigo));
}
