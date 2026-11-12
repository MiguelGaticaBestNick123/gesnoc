import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { bloquearCuenta, cerrarCuenta, consumoYPagos } from '@/modules/venta/repositorios/cuentas';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { ErrorDeNegocio } from '@/shared/errores';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { describirDiferencia, enumerar, repartir } from '../calculos';
import * as caja from '../repositorios/caja';

// La caja de la noche (bloque 3, fase A): confirmar el efectivo, cerrar cuentas con saldo, contar la
// caja y cerrar la noche. Todo es de la administración (RN-18) y todo corre dentro de la noche
// abierta: después del cierre nada cambia (RN-26).

const suma = (montos: number[]) => montos.reduce((total, monto) => total + monto, 0);

/** HU-26: el efectivo que falta confirmar, agrupado por garzón. */
export async function pantallaEfectivo(actor: Actor) {
  exigir(actor, 'admin');
  const fecha = await fechaAbierta();
  if (!fecha) return { noche: null, garzones: [] };
  const pagos = await caja.efectivoSinConfirmar(fecha);
  const garzones = [...new Map(pagos.map((p) => [p.usuarioId, p.garzon]))].map(
    ([usuarioId, garzon]) => {
      const suyos = pagos.filter((p) => p.usuarioId === usuarioId);
      return {
        usuarioId,
        garzon,
        pagos: suyos,
        monto: suma(suyos.map((p) => p.monto)),
        propinas: suma(suyos.map((p) => p.propina)),
      };
    },
  );
  return { noche: fecha, garzones };
}

export type PantallaEfectivo = Awaited<ReturnType<typeof pantallaEfectivo>>;

/**
 * HU-26: confirma los pagos que la administración tenía a la vista, ni uno más: si mientras miraba
 * llegó otro pago del mismo garzón, ese queda pendiente (plan del bloque 3, sección 3.3). Registra
 * quién y cuándo (CA2), y repetir la confirmación no cambia nada.
 */
export async function confirmarEfectivo(actor: Actor, pagos: { cuenta: number; numero: number }[]) {
  exigir(actor, 'admin');
  return enLaNoche(async (tx, fecha) => {
    const confirmados = await caja.confirmarPagos(tx, fecha, pagos, actor.id);
    return {
      confirmados: confirmados.length,
      monto: suma(confirmados.map((p) => p.monto + p.propina)),
    };
  });
}

/** HU-27: las cuentas abiertas de la noche, con su saldo. */
export async function pantallaSaldos(actor: Actor) {
  exigir(actor, 'admin');
  const fecha = await fechaAbierta();
  return { noche: fecha ?? null, cuentas: fecha ? await caja.cuentasAbiertas(fecha) : [] };
}

export type PantallaSaldos = Awaited<ReturnType<typeof pantallaSaldos>>;

/**
 * HU-27: la administración cierra una cuenta aunque tenga saldo (un cliente que se fue, una
 * invitación). Queda registrado quién y cuándo, y el saldo pendiente se deriva (RN-18). La cuenta se
 * bloquea como en el cobro: si un pago la cerró un instante antes, gana el primero.
 */
export async function cerrarConSaldo(actor: Actor, numero: number) {
  exigir(actor, 'admin');
  return enLaNoche(async (tx, fecha) => {
    const cuenta = await bloquearCuenta(tx, fecha, numero);
    if (!cuenta) throw new ErrorDeNegocio('Esa cuenta no existe');
    if (cuenta.cerrada) throw new ErrorDeNegocio('La cuenta ya está cerrada');
    const { consumo, pagado } = await consumoYPagos(tx, fecha, numero);
    await cerrarCuenta(tx, fecha, numero, actor.id);
    return { saldo: consumo - pagado };
  });
}

/** HU-28: el esperado desglosado y el conteo, si ya se hizo. */
export async function pantallaArqueo(actor: Actor) {
  exigir(actor, 'admin');
  const fecha = await fechaAbierta();
  if (!fecha) return { noche: null, esperado: null, conteo: null, sinConfirmar: 0 };
  const [esperado, conteo, pendientes] = await Promise.all([
    caja.esperado(db(), fecha),
    caja.conteoDe(db(), fecha),
    caja.efectivoSinConfirmar(fecha),
  ]);
  return { noche: fecha, esperado, conteo: conteo ?? null, sinConfirmar: pendientes.length };
}

export type PantallaArqueo = Awaited<ReturnType<typeof pantallaArqueo>>;

/**
 * HU-28: guarda el conteo. El esperado se calcula dentro de la misma transacción, y si el contado
 * no coincide la nota es obligatoria (RN-20). Se puede volver a contar.
 */
export async function contar(actor: Actor, contado: number, nota: string | null) {
  exigir(actor, 'admin');
  return enLaNoche(async (tx, fecha) => {
    const esperado = await caja.esperado(tx, fecha);
    if (!esperado) throw new ErrorDeNegocio('La noche no tiene arqueo');
    const diferencia = contado - esperado.total;
    if (diferencia !== 0 && !nota) {
      throw new ErrorDeNegocio(
        `El contado no cuadra con el esperado (${describirDiferencia(diferencia)}): explica la diferencia en la nota`,
      );
    }
    await caja.guardarConteo(tx, fecha, contado, nota, actor.id);
    return { esperado: esperado.total, contado, diferencia };
  });
}

/** Lo que muestra «Noche en curso» antes de cerrar: los pendientes y la caja (CU-11). */
export async function estadoDelCierre(actor: Actor) {
  exigir(actor, 'admin');
  const fecha = await fechaAbierta();
  if (!fecha) return null;
  const [pendientes, esperado, conteo] = await db().transaction(async (tx) =>
    Promise.all([
      caja.pendientesDelCierre(tx, fecha),
      caja.esperado(tx, fecha),
      caja.conteoDe(tx, fecha),
    ]),
  );
  return { fecha, pendientes, esperado, conteo: conteo ?? null };
}

export type EstadoDelCierre = NonNullable<Awaited<ReturnType<typeof estadoDelCierre>>>;

/**
 * HU-12: cierra la noche en una sola transacción, con la noche bloqueada en modo exclusivo:
 * 1. Si quedan cuentas abiertas, efectivo sin confirmar o la caja sin contar, no cambia nada y dice
 *    qué falta (RN-20).
 * 2. Recalcula el esperado: si cambió después del conteo y no hay nota, pide volver a contar.
 * 3. Anonimiza a los clientes sin visitas en los últimos 12 meses (RN-25).
 * 4. Marca la noche cerrada: desde ahí ninguna operación la toca (RN-26) y el personal pierde el
 *    acceso de su turno (RN-05).
 */
export async function cerrarNoche(actor: Actor, fecha: string) {
  exigir(actor, 'admin');
  return db().transaction(async (tx) => {
    if (!(await caja.bloquearNocheParaCerrar(tx, fecha))) {
      throw new ErrorDeNegocio('Esa noche no está abierta');
    }
    const pendientes = await caja.pendientesDelCierre(tx, fecha);
    const faltas = [
      pendientes.cuentasAbiertas > 0 &&
        `${pendientes.cuentasAbiertas} ${pendientes.cuentasAbiertas === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`,
      pendientes.efectivoSinConfirmar > 0 &&
        `${pendientes.efectivoSinConfirmar} ${pendientes.efectivoSinConfirmar === 1 ? 'pago' : 'pagos'} en efectivo sin confirmar`,
      pendientes.sinContar && 'la caja sin contar',
    ].filter((falta): falta is string => Boolean(falta));
    if (faltas.length > 0) {
      throw new ErrorDeNegocio(`No se puede cerrar: queda ${enumerar(faltas)}`);
    }
    const [esperado, conteo] = await Promise.all([
      caja.esperado(tx, fecha),
      caja.conteoDe(tx, fecha),
    ]);
    if (esperado && conteo && conteo.contado !== esperado.total && !conteo.nota) {
      throw new ErrorDeNegocio(
        `El esperado cambió a ${formatearPesos(esperado.total)} después del conteo: vuelve a contar o explica la diferencia`,
      );
    }
    const anonimizados = await caja.anonimizar(tx, fecha);
    await caja.marcarCerrada(tx, fecha);
    return { anonimizados };
  });
}

/**
 * HU-29: lo vendido, lo cobrado por medio de pago y las propinas por ambiente, con la parte de cada
 * persona: las propinas de un ambiente se reparten entre los garzones y barman que tuvieron turno
 * en él (regla del Product Owner, 12 nov). Las cifras de la caja son las mismas del arqueo (CA2).
 */
export async function ventasYPropinas(actor: Actor, fecha?: string) {
  exigir(actor, 'admin');
  const noches = await caja.nochesConVentas();
  const elegida = noches.find((n) => n.fecha === fecha) ?? noches[0] ?? null;
  if (!elegida) return { noches, elegida: null, detalle: null };
  const [ambientes, medios, equipo, entradas, pendientes, esperado, conteo] = await Promise.all([
    caja.ventasPorAmbiente(elegida.fecha),
    caja.cobradoPorMedio(elegida.fecha),
    caja.equipoPorAmbiente(elegida.fecha),
    caja.entradasPorForma(elegida.fecha),
    caja.entradasPendientes(elegida.fecha),
    caja.esperado(db(), elegida.fecha),
    caja.conteoDe(db(), elegida.fecha),
  ]);
  const porAmbiente = ambientes.map((ambiente) => {
    const personas = equipo.filter((p) => p.ambienteId === ambiente.ambienteId);
    const partes = repartir(ambiente.propinas, personas.length);
    return {
      ...ambiente,
      reparto: personas.map((persona, i) => ({ ...persona, parte: partes[i]! })),
    };
  });
  const total = (campo: 'vendido' | 'cobrado' | 'propinas' | 'porCobrar' | 'cerradoConSaldo') =>
    suma(ambientes.map((a) => a[campo]));
  return {
    noches,
    elegida,
    detalle: {
      totales: {
        vendido: total('vendido'),
        cobrado: total('cobrado'),
        propinas: total('propinas'),
        porCobrar: total('porCobrar'),
        cerradoConSaldo: total('cerradoConSaldo'),
      },
      ambientes: porAmbiente,
      medios,
      entradas,
      pendientes,
      esperado,
      conteo: conteo ?? null,
    },
  };
}

export type VentasYPropinas = Awaited<ReturnType<typeof ventasYPropinas>>;
