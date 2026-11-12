'use server';

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
    const { contado, nota } = datosConteo.parse(campos(datos));
    return caja.contar(actor, contado, nota);
  });
}

export async function cerrarNoche(_: EstadoAccion, datos: FormData) {
  return ejecutar((actor) =>
    caja.cerrarNoche(actor, datosCierreDeNoche.parse(campos(datos)).fecha),
  );
}
