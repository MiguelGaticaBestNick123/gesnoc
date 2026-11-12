import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { ErrorDeNegocio } from '@/shared/errores';
import { formatearPesos } from '@/shared/utilidades/dinero';
import type { MedioDePago } from '../cuenta';
import type { DatosPago } from '../esquemas';
import {
  bloquearCuenta,
  cerrarCuenta,
  consumoYPagos,
  encabezadoCuenta,
} from '../repositorios/cuentas';
import * as pagos from '../repositorios/pagos';

/** `pago_numero_check`: una cuenta admite hasta 50 abonos. */
const MAXIMO_DE_PAGOS = 50;

export interface PagoHecho {
  numero: number;
  medio: MedioDePago;
  monto: number;
  propina: number;
  /** Lo que queda por cobrar en la cuenta. */
  saldo: number;
  /** La cuenta quedó cerrada y su mesa libre (HU-24 CA3). */
  cerrada: boolean;
  /** La clave ya estaba registrada: es un reintento y no se cobró de nuevo (RN-13). */
  repetido: boolean;
}

/**
 * HU-24 y HU-25: registra un abono con su medio y su propina. Primero la noche (RN-26) y la cuenta:
 * con la cuenta bloqueada, dos cobros simultáneos, o un cobro y un pedido, se atienden de a uno
 * (RN-18). Después la clave de envío, antes que el estado de la cuenta, para que un reintento
 * devuelva el pago original aunque ese mismo pago la haya cerrado (RN-13).
 */
export async function cobrar(actor: Actor, datos: DatosPago): Promise<PagoHecho> {
  // Un reintento de un cobro que ya quedó registrado recibe lo registrado aunque entretanto se haya
  // cerrado la noche y su turno ya no exista: un 4xx le diría al teléfono que no se cobró (RN-13).
  // Solo quien lo registró (o la administración) lo recibe.
  const yaCobrado = await pagos.pagoPorClave(db(), datos.claveEnvio);
  if (
    yaCobrado?.cuenta === datos.cuenta &&
    (yaCobrado.registradoPor === actor.id || actor.esAdministrador)
  ) {
    const [{ consumo, pagado }, cuenta] = await Promise.all([
      consumoYPagos(db(), yaCobrado.fecha, datos.cuenta),
      encabezadoCuenta(yaCobrado.fecha, datos.cuenta),
    ]);
    const { numero, medio, monto, propina } = yaCobrado;
    return {
      numero,
      medio,
      monto,
      propina,
      saldo: consumo - pagado,
      cerrada: Boolean(cuenta?.cerradaEn),
      repetido: true,
    };
  }
  exigir(actor, 'garzon');

  return enLaNoche(async (tx, fecha) => {
    const cuenta = await bloquearCuenta(tx, fecha, datos.cuenta);
    if (!cuenta) throw new ErrorDeNegocio('Esa cuenta no existe');
    exigir(actor, 'garzon', { ambienteId: cuenta.ambienteId }); // RN-14

    const previo = await pagos.pagoPorClave(tx, datos.claveEnvio);
    if (previo) {
      if (previo.fecha !== fecha || previo.cuenta !== datos.cuenta) {
        throw new ErrorDeNegocio('Esa clave de envío ya se usó en otro cobro');
      }
      const { consumo, pagado } = await consumoYPagos(tx, fecha, datos.cuenta);
      const { numero, medio, monto, propina } = previo;
      return {
        numero,
        medio,
        monto,
        propina,
        saldo: consumo - pagado,
        cerrada: cuenta.cerrada,
        repetido: true,
      };
    }
    if (cuenta.cerrada) throw new ErrorDeNegocio('La cuenta ya está cerrada'); // CU-18 4b

    const { consumo, pagado, pagos: cantidad } = await consumoYPagos(tx, fecha, datos.cuenta);
    const saldo = consumo - pagado;
    if (saldo <= 0) throw new ErrorDeNegocio('La cuenta no tiene saldo por cobrar');
    if (datos.monto > saldo) {
      throw new ErrorDeNegocio(`El monto supera el saldo de ${formatearPesos(saldo)}`); // RN-18
    }
    if (cantidad >= MAXIMO_DE_PAGOS) {
      throw new ErrorDeNegocio(`La cuenta ya tiene ${MAXIMO_DE_PAGOS} pagos, el máximo`);
    }

    const numero = await pagos.siguientePago(tx, fecha, datos.cuenta);
    await pagos.insertarPago(tx, {
      fecha,
      cuentaNumero: datos.cuenta,
      numero,
      medio: datos.medio,
      monto: datos.monto,
      propina: datos.propina,
      registradoPor: actor.id,
      claveEnvio: datos.claveEnvio,
    });
    // HU-24 CA3: al cubrir el saldo la cuenta se cierra y su mesa queda libre (RN-18). El efectivo
    // sigue pendiente de confirmar, pero eso no retiene la mesa (lección S-03 del sistema anterior).
    const cerrada = datos.monto === saldo;
    if (cerrada) await cerrarCuenta(tx, fecha, datos.cuenta, actor.id);
    return {
      numero,
      medio: datos.medio,
      monto: datos.monto,
      propina: datos.propina,
      saldo: saldo - datos.monto,
      cerrada,
      repetido: false,
    };
  });
}

/**
 * CU-18 paso 6: el efectivo que cobró la persona en la noche y que todavía debe entregar a la
 * administración, con la propina incluida, porque también pasa por la caja (RN-17, RN-19).
 */
export async function miEfectivo(actor: Actor) {
  exigir(actor, 'garzon');
  const fecha = await fechaAbierta();
  const pendientes = fecha ? await pagos.efectivoPorEntregar(fecha, actor.id) : [];
  return {
    noche: fecha ?? null,
    pagos: pendientes,
    total: pendientes.reduce((suma, pago) => suma + pago.monto + pago.propina, 0),
  };
}

export type MiEfectivo = Awaited<ReturnType<typeof miEfectivo>>;
