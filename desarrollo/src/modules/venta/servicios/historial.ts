import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { exigir, type Actor, type Permiso } from '@/shared/autorizacion';
import { armarHistorial } from '../historial';
import { estacionesDelTipo } from '../repositorios/colas';
import * as repositorio from '../repositorios/historial';

export type PermisoHistorial = Extract<Permiso, 'admin' | 'garzon' | 'barra' | 'cocina'>;

/**
 * Historial de comandas de la noche abierta (pedido del Product Owner, 18 nov): lo ven garzón,
 * barra, cocina y administración. Quien prepara parte viendo lo de su estación; garzón y
 * administración, todo. Sin noche abierta no hay historial que mostrar.
 */
export async function historialDeComandas(actor: Actor, permiso: PermisoHistorial) {
  exigir(actor, permiso);
  const fecha = await fechaAbierta();
  if (!fecha) {
    return { noche: null, estaciones: [], pedidos: [], estacionInicial: null };
  }
  const [comandas, lineas, barras, cocinas] = await Promise.all([
    repositorio.comandasDeLaNoche(fecha),
    repositorio.lineasDeLaNoche(fecha),
    estacionesDelTipo('barra'),
    estacionesDelTipo('cocina'),
  ]);
  const estacionInicial =
    permiso === 'barra'
      ? (barras.find((barra) => barra.ambienteId === actor.turno?.ambienteId)?.id ?? null)
      : permiso === 'cocina'
        ? (cocinas[0]?.id ?? null)
        : null;
  return {
    noche: fecha,
    estaciones: [...barras, ...cocinas].map(({ id, nombre }) => ({ id, nombre })),
    pedidos: armarHistorial(comandas, lineas),
    estacionInicial,
  };
}

export type HistorialDeComandas = Awaited<ReturnType<typeof historialDeComandas>>;
