import 'server-only';
import { nochesConVentas } from '@/modules/caja/repositorios/caja';
import { exigir, type Actor } from '@/shared/autorizacion';
import { categoria, describir } from '../bitacora';
import { eventosDeLaNoche } from '../repositorios/bitacora';

/**
 * La bitácora de una noche (la elegida o la más reciente) para la administración: quién hizo qué y
 * cuándo, de lo registrado. Es la cara visible del objetivo general: la noche queda trazable y
 * verificable sin una tabla de auditoría aparte.
 */
export async function bitacora(actor: Actor, fecha?: string) {
  exigir(actor, 'admin');
  const noches = await nochesConVentas();
  const elegida = noches.find((n) => n.fecha === fecha) ?? noches[0] ?? null;
  if (!elegida) return { noches, elegida: null, eventos: [] };
  const eventos = (await eventosDeLaNoche(elegida.fecha)).map((evento) => ({
    marca: evento.marca,
    actor: evento.actor,
    categoria: categoria(evento.tipo),
    texto: describir(evento),
  }));
  return { noches, elegida, eventos };
}

export type Bitacora = Awaited<ReturnType<typeof bitacora>>;
