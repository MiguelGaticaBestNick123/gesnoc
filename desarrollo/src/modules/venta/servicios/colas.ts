import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, puede, type Actor, type Permiso } from '@/shared/autorizacion';
import { ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { armarCola, type TipoEstacion } from '../cola';
import { ordenarMisComandas } from '../cuenta';
import * as colas from '../repositorios/colas';
import type { LlamadoPendiente } from '../repositorios/llamados';
import { llamadosPendientes } from './llamados';

const permisoDe: Record<TipoEstacion, Permiso> = { barra: 'barra', cocina: 'cocina' };

/**
 * Una sola regla decide qué estaciones ve una persona y cuáles puede marcar: el barman atiende la
 * barra del ambiente de su turno (RN-14), quien cocina atiende la cocina, que es de todo el local,
 * y la administración, todas. Con dos reglas separadas, el sistema anterior dejaba a un barman ver
 * comandas que no podía marcar.
 */
export const puedeAtender = (
  actor: Actor,
  estacion: { tipo: TipoEstacion; ambienteId: number | null },
) => puede(actor, permisoDe[estacion.tipo], { ambienteId: estacion.ambienteId });

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

/**
 * HU-20: lo que el garzón tiene que retirar. El aviso no es una tabla: son las comandas listas y sin
 * entregar de los pedidos que tomó él (CA1); entregarlas lo apaga.
 */
export async function misComandas(actor: Actor) {
  exigir(actor, 'garzon');
  const fecha = (await fechaAbierta()) ?? null;
  if (!fecha)
    return { noche: null, listas: [], enPreparacion: [], llamados: [] as LlamadoPendiente[] };
  // HU-40: los llamados de las mesas viajan en esta misma consulta, que acompaña al garzón en todas
  // sus pantallas; así llegan en 5 s o menos (RNF-05) sin sumar otro sondeo por teléfono.
  const [comandas, llamados] = await Promise.all([
    colas.comandasDelGarzon(fecha, actor.id),
    llamadosPendientes(actor, fecha),
  ]);
  return { noche: fecha, ...ordenarMisComandas(comandas), llamados };
}

export type MisComandas = Awaited<ReturnType<typeof misComandas>>;

/**
 * HU-21: la entrega en la mesa. Puede registrarla cualquier garzón del ambiente de la cuenta (RN-14),
 * no solo quien la pidió: a veces la lleva un compañero.
 */
export async function entregar(actor: Actor, pedido: number, estacionId: number) {
  exigir(actor, 'garzon');
  return enLaNoche(async (tx, fecha) => {
    const comanda = await colas.comandaParaEntregar(tx, fecha, pedido, estacionId);
    if (!comanda) throw new ErrorDeNegocio('Esa comanda no existe');
    exigir(actor, 'garzon', { ambienteId: comanda.ambienteId });
    if (!comanda.lista) throw new ErrorDeNegocio('La comanda aún no está lista'); // CA1
    return colas.marcarEntregada(tx, fecha, pedido, estacionId);
  });
}
