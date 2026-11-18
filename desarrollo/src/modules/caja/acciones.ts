'use server';

import { redirect } from 'next/navigation';
import { ejecutar, type EstadoAccion } from '@/shared/acciones';
import {
  datosCierreDeCuenta,
  datosCierreDeNoche,
  datosConfirmacion,
  datosConteo,
} from './esquemas';
import * as caja from './servicios/caja';

const campos = (datos: FormData) => Object.fromEntries(datos);

export async function confirmarEfectivo(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) =>
    caja.confirmarEfectivo(actor, datosConfirmacion.parse(campos(datos)).pagos),
  );
}

export async function cerrarConSaldo(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) =>
    caja.cerrarConSaldo(actor, datosCierreDeCuenta.parse(campos(datos)).numero),
  );
}

export async function contarCaja(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) => {
    const { contado, nota, esperado } = datosConteo.parse(campos(datos));
    return caja.contar(actor, contado, nota, esperado);
  });
}

/**
 * HU-12: cierra la noche. CU-11 paso 6: cerrada, la administración llega a «Ventas y propinas» de
 * esa noche, con el resultado del arqueo (esperado, contado, diferencia y nota) y cuántos clientes
 * se anonimizaron.
 */
export async function cerrarNoche(_: EstadoAccion, datos: FormData) {
  const cerrada: { fecha?: string; anonimizados?: number } = {};
  const estado = await ejecutar(async (actor) => {
    const { fecha } = datosCierreDeNoche.parse(campos(datos));
    Object.assign(cerrada, { fecha }, await caja.cerrarNoche(actor, fecha));
  });
  if (estado.ok && cerrada.fecha) {
    redirect(`/admin/ventas?fecha=${cerrada.fecha}&cerrada=${cerrada.anonimizados ?? 0}`);
  }
  return estado;
}
