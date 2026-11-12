import 'server-only';
import { anularConteo } from '@/modules/caja/repositorios/caja';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche, nocheEnCurso } from '@/modules/noche/servicios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { ErrorDeNegocio } from '@/shared/errores';
import { formatearPesos } from '@/shared/utilidades/dinero';
import type { DatosEntrada } from '../esquemas';
import { formaDe, type FormaDeEntrada } from '../formas';
import * as puerta from '../repositorios/puerta';

// La puerta (HU-30, HU-32 y HU-33, ajustadas por el Product Owner el 12 nov). El guardia ve quién
// entró, con su ticket, documento y forma de entrada, pero no lo recaudado: eso es de la
// administración. Los datos de los clientes solo los ven el guardia y la administración (RN-25).

/**
 * HU-30 CA2: lo que sabe la puerta de un documento. Si ya entró esta noche, a qué hora y con qué
 * ticket; si ya vino antes, su nombre y cuántas veces; si está invitado o en una lista, quién lo
 * invitó y si entra gratis (HU-33).
 */
export async function buscar(actor: Actor, documento: string) {
  exigir(actor, 'guardia');
  const fecha = await nocheEnCurso();
  const [cliente, invitacion, precio] = await Promise.all([
    puerta.clientePorDocumento(db(), documento),
    puerta.invitacionDe(fecha, documento),
    puerta.precioDeLaNoche(db(), fecha),
  ]);
  const [entrada, visitas] = cliente
    ? await Promise.all([
        puerta.entradaDe(db(), fecha, cliente.id),
        puerta.visitasAnteriores(cliente.id, fecha),
      ])
    : [undefined, 0];
  return {
    documento,
    precio,
    cliente: cliente ? { nombre: cliente.nombre, apellido: cliente.apellido, visitas } : null,
    entrada: entrada
      ? {
          ticket: entrada.ticket,
          forma: formaDe(entrada.medio),
          registradaEn: entrada.registradaEn,
        }
      : null,
    invitacion: invitacion ?? null,
  };
}

export type Busqueda = Awaited<ReturnType<typeof buscar>>;

export interface IngresoRegistrado {
  documento: string;
  nombre: string;
  apellido: string;
  ticket: number | null;
  forma: FormaDeEntrada;
  registradaEn: string;
  /** Ya había entrado (o es el reintento de un registro que llegó): se muestra lo registrado. */
  repetida: boolean;
}

/**
 * HU-30: registra la entrada. Todo ocurre con los ingresos de la noche bloqueados: si la persona ya
 * entró, devuelve esa entrada con su hora y su ticket, y así un reintento tras un corte no la
 * duplica (RN-21). Solo una entrada pagada (EF, RC o PN) recibe el siguiente ticket (RN-22).
 */
export async function registrar(actor: Actor, datos: DatosEntrada): Promise<IngresoRegistrado> {
  exigir(actor, 'guardia');
  return enLaNoche(async (tx, fecha) => {
    await puerta.bloquearIngresos(tx, fecha);
    const existente = await puerta.clientePorDocumento(tx, datos.documento);
    if (existente) {
      const previa = await puerta.entradaDe(tx, fecha, existente.id);
      if (previa) {
        return {
          documento: datos.documento,
          nombre: existente.nombre,
          apellido: existente.apellido,
          ticket: previa.ticket,
          forma: formaDe(previa.medio),
          registradaEn: previa.registradaEn,
          repetida: true,
        };
      }
    }

    const pagada = datos.forma !== 'gratis';
    const precio = await puerta.precioDeLaNoche(tx, fecha);
    if (pagada && precio === 0) throw new ErrorDeNegocio('Esta noche la entrada es gratis');
    if (pagada && datos.monto !== precio) {
      throw new ErrorDeNegocio(
        `El precio de la entrada cambió a ${formatearPesos(precio)}: confirma el cobro`,
      );
    }

    let persona = existente;
    if (!persona) {
      if (!datos.nombre || !datos.apellido) {
        throw new ErrorDeNegocio('Es la primera vez que viene: escribe su nombre y apellido');
      }
      const nueva = { documento: datos.documento, nombre: datos.nombre, apellido: datos.apellido };
      persona = { id: await puerta.asegurarCliente(tx, nueva), ...nueva };
    }

    const ticket = pagada ? await puerta.siguienteTicket(tx, fecha) : null;
    const registradaEn = await puerta.insertarEntrada(tx, {
      fecha,
      clienteId: persona.id,
      monto: pagada ? precio : 0,
      medioPago: pagada ? datos.forma : null,
      ticket,
      registradaPor: actor.id,
    });
    // Una entrada en efectivo cambia el esperado de la caja: un conteo anterior deja de valer.
    if (datos.forma === 'efectivo') await anularConteo(tx, fecha);
    return {
      documento: datos.documento,
      nombre: persona.nombre,
      apellido: persona.apellido,
      ticket,
      forma: datos.forma,
      registradaEn,
      repetida: false,
    };
  });
}

/**
 * HU-32, como la pidió el Product Owner: quiénes entraron, con hora, ticket, nombre, documento y
 * forma de entrada, al día cada 3 segundos. Sin montos ni recaudación.
 */
export async function ingresosDeLaNoche(actor: Actor) {
  exigir(actor, 'guardia');
  const fecha = await fechaAbierta();
  if (!fecha) return { noche: null, precio: 0, ingresos: [], ultimoTicket: null };
  const [ingresos, precio] = await Promise.all([
    puerta.ingresosDe(fecha),
    puerta.precioDeLaNoche(db(), fecha),
  ]);
  const tickets = ingresos.flatMap((i) => (i.ticket === null ? [] : [i.ticket]));
  return {
    noche: fecha,
    precio,
    ingresos: ingresos.map(({ medio, ...ingreso }) => ({ ...ingreso, forma: formaDe(medio) })),
    ultimoTicket: tickets.length > 0 ? Math.max(...tickets) : null,
  };
}

export type IngresosDeLaNoche = Awaited<ReturnType<typeof ingresosDeLaNoche>>;
