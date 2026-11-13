import 'server-only';
import QRCode from 'qrcode';
import { exigir, type Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio } from '@/shared/errores';
import { enlaceDeCarta } from '../carta';
import { listarAmbientes } from '../repositorios/ambientes';
import * as carta from '../repositorios/carta';

/**
 * El QR como SVG generado en el servidor: no agrega JavaScript al navegador y se imprime nítido a
 * cualquier tamaño. Corrección «M» (15 %): aguanta una mancha o un doblez de la tarjeta impresa.
 */
const svgDelEnlace = (enlace: string) =>
  QRCode.toString(enlace, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });

/**
 * HU-07 CA1: el código de cada mesa activa del ambiente elegido (o del primero), con su enlace y su
 * imagen. `origen` es el dominio con que la administración abrió la aplicación.
 */
export async function codigosDeMesas(actor: Actor, origen: string, ambienteId?: number) {
  exigir(actor, 'admin');
  const ambientes = (await listarAmbientes())
    .filter((a) => a.activo)
    .map(({ id, nombre }) => ({ id, nombre }));
  const ambiente = ambientes.find((a) => a.id === ambienteId) ?? ambientes[0] ?? null;
  if (!ambiente) return { ambientes, ambiente, mesas: [] };

  const mesas = await Promise.all(
    (await carta.codigosDelAmbiente(ambiente.id)).map(async ({ id, numero, codigo }) => {
      const enlace = enlaceDeCarta(origen, codigo);
      return { id, numero, enlace, svg: await svgDelEnlace(enlace) };
    }),
  );
  return { ambientes, ambiente, mesas };
}

export type CodigosDeMesas = Awaited<ReturnType<typeof codigosDeMesas>>;

/** HU-07 CA3: el código de una mesa como archivo SVG para descargarlo e imprimirlo. */
export async function archivoDelCodigo(actor: Actor, origen: string, mesaId: number) {
  exigir(actor, 'admin');
  const mesa = await carta.codigoDeMesa(mesaId);
  if (!mesa) throw new ErrorDeNegocio('Esa mesa no existe o fue retirada');
  // «Salón» → «salon»: sin tildes (las marcas que deja NFD), y lo demás como guion.
  const ambiente = mesa.ambiente
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return {
    nombre: `qr-${ambiente}-mesa-${mesa.numero}.svg`,
    svg: await svgDelEnlace(enlaceDeCarta(origen, mesa.codigo)),
  };
}

/**
 * HU-07 CA2 (RN-28): un código nuevo para la mesa. El impreso deja de abrir la carta, por ejemplo si
 * alguien se lo llevó y llama al garzón desde afuera.
 */
export async function regenerarCodigo(actor: Actor, mesaId: number) {
  exigir(actor, 'admin');
  if (!(await carta.regenerarCodigo(mesaId))) {
    throw new ErrorDeNegocio('Esa mesa no existe o fue retirada');
  }
}
