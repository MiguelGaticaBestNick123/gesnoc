import { misComandas } from '@/modules/venta/servicios/colas';
import { operar } from '@/shared/rutas';

// HU-20: las comandas del garzón; las listas son su aviso. Se consulta cada pocos segundos (RNF-05).
export async function GET() {
  return operar((actor) => misComandas(actor));
}
