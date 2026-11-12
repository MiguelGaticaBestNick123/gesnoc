import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import type { UbicacionCuenta } from '../esquemas';
import * as cuentas from '../repositorios/cuentas';
import { estaciones, productosActivos } from '../repositorios/pedidos';
import { agruparPedidos, resumenCuenta } from '../cuenta';
import { estacionDestino } from '../ruteo';

export { nocheEnCurso } from '@/modules/noche/servicios/noches';
import { nocheEnCurso } from '@/modules/noche/servicios/noches';

/** El garzón ve el ambiente de su turno; la administración elige cualquiera. */
async function ambienteVisible(actor: Actor, pedido?: number) {
  exigir(actor, 'garzon');
  const activos = await cuentas.ambientesActivos();
  const id = actor.esAdministrador
    ? (activos.find((a) => a.id === pedido)?.id ?? activos[0]?.id)
    : actor.turno?.ambienteId;
  const ambiente = activos.find((a) => a.id === id);
  if (!ambiente) throw new ErrorDeNegocio('No hay un ambiente activo para mostrar');
  return { ambiente, ambientes: actor.esAdministrador ? activos : [ambiente] };
}

/** Estado del mapa de un ambiente (HU-13): ocupada es tener una cuenta abierta en la noche. */
export async function mapa(actor: Actor, ambienteId?: number) {
  const { ambiente, ambientes } = await ambienteVisible(actor, ambienteId);
  const fecha = await fechaAbierta();
  const [mesas, dePie] = await Promise.all([
    cuentas.mesasDe(fecha, ambiente.id),
    fecha ? cuentas.cuentasDePie(fecha, ambiente.id) : [],
  ]);
  return {
    noche: fecha ?? null,
    ambiente,
    ambientes: ambientes.map(({ id, nombre }) => ({ id, nombre })),
    mesas,
    dePie,
  };
}

export type Mapa = Awaited<ReturnType<typeof mapa>>;

/** HU-14: abre una cuenta en una mesa libre o para un cliente de pie. */
export async function abrir(actor: Actor, datos: UbicacionCuenta) {
  exigir(actor, 'garzon');
  let ambienteId: number;
  if ('mesaId' in datos) {
    const mesa = await cuentas.buscarMesa(datos.mesaId);
    if (!mesa?.activa) throw new ErrorDeNegocio('Esa mesa no existe');
    ambienteId = mesa.ambienteId;
  } else {
    ambienteId = datos.ambienteId;
    const activos = await cuentas.ambientesActivos();
    if (!activos.some((a) => a.id === ambienteId))
      throw new ErrorDeNegocio('Ese ambiente no existe');
  }
  exigir(actor, 'garzon', { ambienteId }); // RN-14
  return traducir(
    enLaNoche(async (tx, fecha) => {
      if ('mesaId' in datos && !(await cuentas.mesaActiva(tx, datos.mesaId))) {
        throw new ErrorDeNegocio('Esa mesa ya no está en el plano');
      }
      return cuentas.abrirCuenta(tx, fecha, actor.id, datos);
    }),
    { cuenta_mesa_abierta_uq: 'La mesa tiene una cuenta abierta de otra noche' },
  );
}

/**
 * Cierra una cuenta abierta por error: sin consumo vigente y sin pagos no hay saldo que cobrar, y sin
 * esta salida la mesa quedaría ocupada e impediría cerrar la noche (regla nueva, extiende RN-18).
 */
export async function cerrarSinConsumo(actor: Actor, numero: number) {
  exigir(actor, 'garzon');
  await enLaNoche(async (tx, fecha) => {
    const cuenta = await cuentas.bloquearCuenta(tx, fecha, numero);
    if (!cuenta) throw new ErrorDeNegocio('Esa cuenta no existe');
    exigir(actor, 'garzon', { ambienteId: cuenta.ambienteId });
    if (cuenta.cerrada) throw new ErrorDeNegocio('La cuenta ya está cerrada');
    const { consumo, pagos } = await cuentas.consumoYPagos(tx, fecha, numero);
    if (consumo > 0 || pagos > 0) {
      throw new ErrorDeNegocio('La cuenta tiene consumo: se cierra al cobrar el saldo');
    }
    await cuentas.cerrarCuenta(tx, fecha, numero, actor.id);
  });
}

/** Lo que necesita la pantalla para tomar un pedido: la cuenta y el catálogo de su ambiente. */
export async function pantallaPedido(actor: Actor, numero: number) {
  exigir(actor, 'garzon');
  const fecha = await nocheEnCurso();
  const cuenta = await cuentas.encabezadoCuenta(fecha, numero);
  if (!cuenta) return null;
  exigir(actor, 'garzon', { ambienteId: cuenta.ambienteId });

  const [productos, todas] = await Promise.all([productosActivos(), estaciones()]);
  const barra = todas.find((e) => e.tipo === 'barra' && e.ambienteId === cuenta.ambienteId);
  const tipoDe = new Map(todas.map((e) => [e.id, e.tipo]));

  const catalogo = productos.map((producto) => {
    const destino = estacionDestino(producto, barra?.id ?? null);
    return {
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      categoriaId: producto.categoriaId,
      // RN-12: el teléfono pide el número de personas cuando hay algo para la cocina.
      paraCocina: destino !== null && tipoDe.get(destino) === 'cocina',
      sinDestino: destino === null,
    };
  });
  const categorias = [...new Map(productos.map((p) => [p.categoriaId, p.categoria]))].map(
    ([id, nombre]) => ({ id, nombre }),
  );
  return { fecha, cuenta, categorias, productos: catalogo };
}

export type PantallaPedido = NonNullable<Awaited<ReturnType<typeof pantallaPedido>>>;

/** HU-23: los pedidos de la cuenta con el estado de cada comanda, el total, lo pagado y el saldo. */
export async function detalleCuenta(actor: Actor, numero: number) {
  exigir(actor, 'garzon');
  const fecha = await nocheEnCurso();
  const cuenta = await cuentas.encabezadoCuenta(fecha, numero);
  if (!cuenta) return null;
  exigir(actor, 'garzon', { ambienteId: cuenta.ambienteId });

  const [lineas, pagos] = await Promise.all([
    cuentas.lineasDeCuenta(fecha, numero),
    cuentas.pagosDeCuenta(fecha, numero),
  ]);
  return {
    /** La noche de la cuenta: el cobro sin confirmar se guarda en el teléfono con ella. */
    fecha,
    cuenta,
    pedidos: agruparPedidos(lineas),
    pagos,
    ...resumenCuenta(lineas, pagos),
    // RN-15: con pagos ya no se anula nada.
    seAnula: cuenta.cerradaEn === null && pagos.length === 0,
  };
}

export type DetalleCuenta = NonNullable<Awaited<ReturnType<typeof detalleCuenta>>>;
