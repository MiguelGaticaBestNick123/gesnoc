import 'server-only';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { bloquearCorrelativo } from '@/shared/db/cliente';
import { ErrorDeNegocio } from '@/shared/errores';
import type { DatosLinea, DatosPedido } from '../esquemas';
import { bloquearCuenta, consumoYPagos } from '../repositorios/cuentas';
import * as pedidos from '../repositorios/pedidos';
import { estacionDestino } from '../ruteo';

export interface PedidoEnviado {
  numero: number;
  estaciones: string[];
  /** La clave ya estaba registrada: es un reintento y no se creó nada nuevo. */
  repetido: boolean;
}

/**
 * HU-16: registra el pedido completo o nada. El orden importa: primero la noche (RN-26) y el
 * correlativo, después se busca la clave de envío (un reintento devuelve el pedido original aunque la
 * cuenta ya se haya cerrado), y recién entonces se bloquea y valida la cuenta.
 */
export async function enviar(actor: Actor, datos: DatosPedido): Promise<PedidoEnviado> {
  exigir(actor, 'garzon');

  return enLaNoche(async (tx, fecha) => {
    await bloquearCorrelativo(tx, 'pedido', fecha);
    const previo = await pedidos.pedidoPorClave(tx, datos.claveEnvio);
    if (previo) return { ...previo, repetido: true }; // RN-13

    const cuenta = await bloquearCuenta(tx, fecha, datos.cuenta);
    if (!cuenta) throw new ErrorDeNegocio('Esa cuenta no existe');
    exigir(actor, 'garzon', { ambienteId: cuenta.ambienteId }); // RN-14
    if (cuenta.cerrada) throw new ErrorDeNegocio('La cuenta ya está cerrada');

    const ids = [...new Set(datos.lineas.map((linea) => linea.productoId))];
    const productos = new Map((await pedidos.productosPorId(tx, ids)).map((p) => [p.id, p]));
    const barra = await pedidos.barraDe(tx, cuenta.ambienteId);

    const lineas = datos.lineas.map((linea) => {
      const producto = productos.get(linea.productoId);
      if (!producto?.activo) {
        throw new ErrorDeNegocio(
          `${producto?.nombre ?? 'Un producto'} ya no está disponible: quítalo del pedido`,
        );
      }
      const estacionId = estacionDestino(producto, barra); // RN-10
      if (estacionId === null) {
        throw new ErrorDeNegocio(
          `Este ambiente no tiene barra configurada: ${producto.nombre} no tiene dónde prepararse`,
        );
      }
      // RN-09: el precio vigente queda copiado en la línea.
      return { ...linea, estacionId, precioUnitario: producto.precio };
    });

    const destinos = await pedidos.estacionesPorId(tx, [
      ...new Set(lineas.map((l) => l.estacionId)),
    ]);
    const vaACocina = destinos.some((estacion) => estacion.tipo === 'cocina');
    if (vaACocina && !datos.personas) {
      throw new ErrorDeNegocio('Indica el número de personas: la cocina lo necesita'); // RN-12
    }

    const numero = await pedidos.siguientePedido(tx, fecha);
    await pedidos.insertarPedido(tx, {
      fecha,
      numero,
      cuentaNumero: datos.cuenta,
      tomadoPor: actor.id,
      personas: vaACocina ? datos.personas : null,
      claveEnvio: datos.claveEnvio,
      lineas,
    });
    return { numero, estaciones: destinos.map((d) => d.nombre), repetido: false };
  });
}

/**
 * HU-22: anula un ítem mal ingresado para que no se prepare ni se cobre. Bloquea la cuenta como el
 * cobro, así una anulación no puede colarse mientras otro garzón está cobrando (RN-15).
 */
export async function anular(actor: Actor, datos: DatosLinea) {
  exigir(actor, 'garzon');
  return enLaNoche(async (tx, fecha) => {
    const cuenta = await bloquearCuenta(tx, fecha, datos.cuenta);
    if (!cuenta) throw new ErrorDeNegocio('Esa cuenta no existe');
    exigir(actor, 'garzon', { ambienteId: cuenta.ambienteId });
    if (cuenta.cerrada) throw new ErrorDeNegocio('La cuenta ya está cerrada');
    const { pagos } = await consumoYPagos(tx, fecha, datos.cuenta);
    if (pagos > 0) {
      throw new ErrorDeNegocio('La cuenta ya tiene pagos: no se pueden anular ítems');
    }
    const anulada = await pedidos.anularLinea(tx, fecha, datos, actor.id);
    if (!anulada) throw new ErrorDeNegocio('Ese ítem no está en la cuenta');
    return anulada;
  });
}
