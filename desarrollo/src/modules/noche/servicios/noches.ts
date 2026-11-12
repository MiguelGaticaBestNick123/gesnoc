import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db, type Transaccion } from '@/shared/db/cliente';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import { rangoDelMes } from '@/shared/utilidades/calendario';
import { hoyEnChile } from '@/shared/utilidades/fechas';
import type { DatosNoche } from '../esquemas';
import { detallesDelRango } from '../repositorios/detalles';
import * as repositorio from '../repositorios/noches';

/**
 * RN-26: cada operación de la noche (cuentas, pedidos, colas, cobros, puerta) corre en esta
 * transacción, que verifica dentro de ella que la noche siga abierta. Sin esto, una operación que
 * leyó la noche antes del cierre se registraba igual en la noche ya cerrada.
 */
export function enLaNoche<T>(
  operacion: (tx: Transaccion, fecha: string) => Promise<T>,
): Promise<T> {
  return db().transaction(async (tx) => {
    const fecha = await repositorio.bloquearNocheAbierta(tx);
    if (!fecha) throw new ErrorDeNegocio('No hay una noche abierta');
    return operacion(tx, fecha);
  });
}

export function listar(actor: Actor) {
  exigir(actor, 'admin');
  return repositorio.listarNoches();
}

export async function programar(actor: Actor, datos: DatosNoche) {
  exigir(actor, 'admin');
  await traducir(repositorio.insertarNoche(datos), {
    noche_pkey: 'Esa noche ya está programada',
  });
}

export async function editar(actor: Actor, datos: DatosNoche) {
  exigir(actor, 'admin');
  const noche = await repositorio.buscarNoche(datos.fecha);
  if (!noche) throw new ErrorDeNegocio('Esa noche no existe');
  if (noche.cerradaEn) throw new ErrorDeNegocio('Una noche cerrada no admite cambios'); // RN-26
  await repositorio.actualizarNoche(datos);
}

export async function eliminar(actor: Actor, fecha: string) {
  exigir(actor, 'admin');
  const eliminadas = await repositorio.eliminarNocheSinAbrir(fecha);
  if (eliminadas.length === 0) {
    throw new ErrorDeNegocio('Solo se puede eliminar una noche que aún no se abre');
  }
}

/** Estado de la noche en curso: la abierta, si la hay, o las que se pueden abrir. */
export async function estado(actor: Actor) {
  exigir(actor, 'admin');
  const [abierta, noches] = await Promise.all([
    repositorio.nocheAbierta(),
    repositorio.listarNoches(),
  ]);
  return { abierta, programadas: noches.filter((noche) => !noche.abiertaEn) };
}

export async function abrir(actor: Actor, fecha: string, fondo: number) {
  exigir(actor, 'admin');
  const abierta = await traducir(repositorio.abrirNoche(fecha, fondo), {
    noche_una_abierta_uq: 'Ya hay una noche abierta', // RN-02
  });
  if (!abierta) throw new ErrorDeNegocio('Esa noche no existe o ya fue abierta');
}

/**
 * El calendario del mes para la administración: cada noche con su estado, quién tiene turno y quién
 * postuló. Los días sin noche se pueden habilitar desde el mismo calendario.
 */
export async function calendarioDelMes(actor: Actor, mes: string) {
  exigir(actor, 'admin');
  const { desde, hasta } = rangoDelMes(mes);
  const [noches, turnos, postulantes, detalles, precioSugerido] = await Promise.all([
    repositorio.nochesDelRango(desde, hasta),
    repositorio.turnosDelRango(desde, hasta),
    repositorio.postulantesDelRango(desde, hasta),
    detallesDelRango(desde, hasta),
    repositorio.ultimoPrecio(),
  ]);
  const delDia = <T extends { fecha: string }>(filas: T[], fecha: string) =>
    filas.filter((fila) => fila.fecha === fecha);
  return {
    mes,
    hoy: hoyEnChile(),
    precioSugerido,
    noches: Object.fromEntries(
      noches.map((n) => [
        n.fecha,
        {
          ...n,
          turnos: delDia(turnos, n.fecha),
          postulantes: delDia(postulantes, n.fecha),
          detalles: detalles.find((d) => d.fecha === n.fecha) ?? null,
        },
      ]),
    ),
  };
}

export type CalendarioDelMes = Awaited<ReturnType<typeof calendarioDelMes>>;
export type NocheDelCalendario = CalendarioDelMes['noches'][string];
