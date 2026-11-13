import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { pendienteDeMesa } from '@/modules/venta/repositorios/llamados';
import { db } from '@/shared/db/cliente';
import { esCodigoDeMesa, type CategoriaCarta } from '../carta';
import * as carta from '../repositorios/carta';

/**
 * Todo lo que ve un desconocido que escanea el QR (HU-38 CA3): la mesa, su ambiente y los productos
 * activos con su precio. Ningún dato de cuentas, clientes ni personal.
 */
export interface CartaPublica {
  mesa: number;
  ambiente: string;
  categorias: CategoriaCarta[];
  /** Hay una noche abierta: el botón para llamar al garzón funciona. */
  atendiendo: boolean;
  /** La mesa ya tiene un llamado sin atender (RN-29). */
  llamadoPendiente: boolean;
}

/**
 * HU-38: la carta de una mesa. Es la única superficie sin sesión: no hay `Actor` ni `exigir`, y el
 * código opaco del QR es la única llave. Un código desconocido o regenerado devuelve `null`, sin
 * distinguir un caso del otro.
 */
export async function cartaDeMesa(codigo: string): Promise<CartaPublica | null> {
  if (!esCodigoDeMesa(codigo)) return null;
  const mesa = await carta.mesaDelCodigo(db(), codigo);
  if (!mesa) return null;

  const [categorias, fecha] = await Promise.all([carta.catalogoPublico(), fechaAbierta()]);
  const llamado = fecha ? await pendienteDeMesa(db(), fecha, mesa.id) : undefined;
  return {
    mesa: mesa.numero,
    ambiente: mesa.ambiente,
    categorias,
    atendiendo: Boolean(fecha),
    llamadoPendiente: llamado !== undefined,
  };
}
