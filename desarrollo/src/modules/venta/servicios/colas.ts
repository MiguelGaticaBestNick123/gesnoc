import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, puede, type Actor, type Permiso } from '@/shared/autorizacion';
import { ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { armarCola, type TipoEstacion } from '../cola';
import * as colas from '../repositorios/colas';

const permisoDe: Record<TipoEstacion, Permiso> = { barra: 'barra', cocina: 'cocina' };

/**
 * Una sola regla decide qué estaciones ve una persona y cuáles puede marcar: el barman o cocinero
 * atiende las de su tipo en el ambiente de su turno (RN-14) y la administración, todas. Con dos
 * reglas separadas, el sistema anterior dejaba a un barman ver comandas que no podía marcar.
 */
export const puedeAtender = (actor: Actor, estacion: { tipo: TipoEstacion; ambienteId: number }) =>
  puede(actor, permisoDe[estacion.tipo], { ambienteId: estacion.ambienteId });

/** HU-17 y HU-18: la cola de una estación en la noche abierta. */
export async function cola(actor: Actor, tipo: TipoEstacion, estacionId?: number) {
  exigir(actor, permisoDe[tipo]);
  const visibles = (await colas.estacionesDelTipo(tipo)).filter((e) => puedeAtender(actor, e));
  const estacion = visibles.find((e) => e.id === estacionId) ?? visibles[0] ?? null;
  const fecha = (await fechaAbierta()) ?? null;
  const estaciones = visibles.map(({ id, nombre }) => ({ id, nombre }));

  if (!estacion || !fecha) {
    return { noche: fecha, tipo, estacion, estaciones, pendientes: [], listas: [] };
  }
  const [comandas, lineas] = await Promise.all([
    colas.comandasSinEntregar(fecha, estacion.id),
    colas.lineasSinEntregar(fecha, estacion.id),
  ]);
  return { noche: fecha, tipo, estacion, estaciones, ...armarCola(comandas, lineas) };
}

export type ColaDeEstacion = Awaited<ReturnType<typeof cola>>;

/** HU-19: marca la comanda lista para que el garzón la retire. Repetirlo no cambia la hora. */
export async function marcarLista(actor: Actor, pedido: number, estacionId: number) {
  return enLaNoche(async (tx, fecha) => {
    const estacion = await colas.buscarEstacion(tx, estacionId);
    if (!estacion) throw new ErrorDeNegocio('Esa estación no existe');
    if (!puedeAtender(actor, estacion)) throw new NoAutorizado();

    const vigentes = await colas.lineasVigentes(tx, fecha, pedido, estacionId);
    if (vigentes === null) throw new ErrorDeNegocio('Esa comanda no existe');
    if (vigentes === 0)
      throw new ErrorDeNegocio('La comanda se anuló completa: no hay nada que preparar');
    return colas.marcarLista(tx, fecha, pedido, estacionId);
  });
}
