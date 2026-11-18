// Tres noches completas, de la programación al cierre (escenarios EV-01 a EV-06, EV-10 y EV-11, e
// indicadores de OE1 a OE4 del capítulo 5 del informe). Cada persona entra con su correo y su
// contraseña, y cada operación arma el actor desde la sesión y el turno de la noche abierta, como
// la aplicación en cada petición; después llama a los mismos servicios que las pantallas. Un libro
// de control anota lo que hizo la simulación y, al cerrar cada noche, se compara con lo registrado.
//
// - Jueves: una noche tranquila, solo con el Salón atendiendo.
// - Viernes: una noche llena (300 pedidos y 400 ingresos en dos ambientes, con dos teléfonos en la
//   puerta), con cortes de red, anulaciones, un producto agotado, una pelea, una diferencia de caja
//   y pendientes al cerrar.
// - Sábado: imprevistos de configuración y de personal: 12 personas de turno, un ambiente nuevo sin
//   barra, una mesa retirada y otra renumerada, una cuenta desactivada, una sesión vencida, un
//   bloqueo por intentos fallidos, una carrera con el cierre y la anonimización de quien cumplió
//   12 meses sin venir.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { datosPersonaNueva } from '@/modules/acceso/esquemas';
import { cerrarSesion, iniciarSesion } from '@/modules/acceso/servicios/autenticacion';
import * as personal from '@/modules/acceso/servicios/personal';
import * as caja from '@/modules/caja/servicios/caja';
import { indicadoresDeLaNoche } from '@/modules/caja/servicios/indicadores';
import * as ambientes from '@/modules/local/servicios/ambientes';
import { cartaDeMesa } from '@/modules/local/servicios/carta';
import * as catalogo from '@/modules/local/servicios/catalogo';
import { guardarPlano } from '@/modules/local/servicios/mapa';
import { regenerarCodigo } from '@/modules/local/servicios/qr';
import { datosInvitacion } from '@/modules/noche/esquemas';
import { bitacora } from '@/modules/noche/servicios/bitacora';
import * as detalles from '@/modules/noche/servicios/detalles';
import * as noches from '@/modules/noche/servicios/noches';
import * as turnos from '@/modules/noche/servicios/turnos';
import { datosEntrada, datosFicha, datosReporte } from '@/modules/porteria/esquemas';
import type { FormaDeEntrada } from '@/modules/porteria/formas';
import * as clientes from '@/modules/porteria/servicios/clientes';
import * as puerta from '@/modules/porteria/servicios/puerta';
import * as sorteo from '@/modules/porteria/servicios/sorteo';
import type { TipoEstacion } from '@/modules/venta/cola';
import {
  montoDeItems,
  partePorPersona,
  propinaDe,
  type FormaDePropina,
} from '@/modules/venta/cobro';
import type { MedioDePago } from '@/modules/venta/cuenta';
import * as colas from '@/modules/venta/servicios/colas';
import * as cuentas from '@/modules/venta/servicios/cuentas';
import * as llamados from '@/modules/venta/servicios/llamados';
import * as pagos from '@/modules/venta/servicios/pagos';
import * as pedidos from '@/modules/venta/servicios/pedidos';
import { resumenDeLaNoche } from '@/modules/venta/servicios/resumen';
import { inicioDe, type Actor, type RolTurno } from '@/shared/autorizacion';
import { NoAutorizado } from '@/shared/errores';
import { actorDeToken } from '@/shared/sesion/actor';
import { digitoVerificador } from '@/shared/utilidades/rut';
import { correoDe, sembrar, vaciar } from '../../db/seeds/demostracion';
import { CLAVE, consultar } from './apoyo';

const SIEMBRA = '2026-12-01';
const JUEVES = '2026-12-03';
const VIERNES = '2026-12-04';
const SABADO = '2026-12-05';
/** Exactamente un año antes del sábado: quien vino ese día y no volvió se anonimiza el sábado. */
const HACE_UN_ANO = '2025-12-05';
const PLAZO = 300_000;

// ---------------------------------------------------------------------------------------------
// Azar con semilla (mulberry32): cada corrida simula las mismas noches.

function azarCon(semilla: number) {
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    entre: (minimo: number, maximo: number) =>
      minimo + Math.floor(siguiente() * (maximo - minimo + 1)),
    uno: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)]!,
    si: (probabilidad: number) => siguiente() < probabilidad,
  };
}
type Azar = ReturnType<typeof azarCon>;

const suma = (montos: number[]) => montos.reduce((total, monto) => total + monto, 0);

/** Un RUT ficticio válido, normalizado (RN-21). */
const rut = (cuerpo: number) => `${cuerpo}-${digitoVerificador(String(cuerpo))}`;

/** El mismo RUT como lo digita alguien apurado: con puntos y la K en minúscula. */
function conPuntos(documento: string) {
  const [cuerpo, verificador] = documento.split('-');
  return `${cuerpo!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${verificador!.toLowerCase()}`;
}

async function cuantos(tabla: 'pedido' | 'pago' | 'llamado', fecha: string) {
  const [fila] = await consultar<{ n: number }[]>`
    select count(*)::int as n from ${consultar('gesnoc')}.${consultar(tabla)}
    where fecha = ${fecha}`;
  return fila!.n;
}

// ---------------------------------------------------------------------------------------------
// Sesiones: cada persona entra con su correo y su contraseña.

const tokens = new Map<string, string>();

async function ingresar(clave: string) {
  tokens.set(clave, await iniciarSesion(correoDe(clave), CLAVE));
}

/** Como la aplicación en cada petición: el actor sale de la sesión y del turno de la noche abierta. */
async function como(clave: string): Promise<Actor> {
  const actor = await actorDeToken(tokens.get(clave) ?? '');
  if (!actor) throw new Error(`La sesión de ${clave} no es válida`);
  return actor;
}

// ---------------------------------------------------------------------------------------------
// El local de demostración, leído de la base una vez sembrado.

interface Producto {
  id: number;
  categoriaId: number;
  categoria: string;
  forzada: string | null;
}

const local = {
  ambiente: new Map<string, number>(),
  estacion: new Map<string, number>(),
  persona: new Map<string, number>(),
  producto: new Map<string, Producto>(),
  /** El precio vigente de cada producto, según la simulación (RN-09). */
  precio: new Map<string, number>(),
};

async function leerLocal() {
  const filas = <T>(promesa: Promise<T[]>) => promesa;
  for (const { id, nombre } of await filas(
    consultar<{ id: number; nombre: string }[]>`select id, nombre from gesnoc.ambiente`,
  )) {
    local.ambiente.set(nombre, id);
  }
  for (const { id, nombre } of await filas(
    consultar<{ id: number; nombre: string }[]>`select id, nombre from gesnoc.estacion`,
  )) {
    local.estacion.set(nombre, id);
  }
  for (const { id, correo } of await filas(
    consultar<{ id: number; correo: string }[]>`select id, correo from gesnoc.usuario`,
  )) {
    local.persona.set(correo.split('@')[0]!, id);
  }
  const productos = await consultar<
    {
      id: number;
      nombre: string;
      precio: number;
      categoria_id: number;
      categoria: string;
      forzada: string | null;
    }[]
  >`
    select p.id, p.nombre, p.precio, p.categoria_id, c.nombre as categoria, e.nombre as forzada
    from gesnoc.producto p
    join gesnoc.categoria c on c.id = p.categoria_id
    left join gesnoc.estacion e on e.id = p.estacion_id`;
  for (const p of productos) {
    local.producto.set(p.nombre, {
      id: p.id,
      categoriaId: p.categoria_id,
      categoria: p.categoria,
      forzada: p.forzada,
    });
    local.precio.set(p.nombre, p.precio);
  }
}

const ambienteId = (nombre: string) => local.ambiente.get(nombre)!;
const estacionId = (nombre: string) => local.estacion.get(nombre)!;
const personaId = (clave: string) => local.persona.get(clave)!;

async function mesaDe(ambiente: string, numero: number) {
  const [fila] = await consultar<{ id: number }[]>`
    select id from gesnoc.mesa
    where ambiente_id = ${ambienteId(ambiente)} and numero = ${numero} and activa`;
  return fila!.id;
}

async function codigoDe(mesaId: number) {
  const [fila] = await consultar<{ token_qr: string }[]>`
    select token_qr from gesnoc.mesa where id = ${mesaId}`;
  return fila!.token_qr;
}

/**
 * RN-10 según el catálogo de la simulación, sin pasar por el sistema: la estación forzada del
 * producto; si no tiene, la cocina para la comida y la barra del ambiente de la cuenta para el resto.
 */
function destinoEsperado(producto: string, ambiente: string) {
  const datos = local.producto.get(producto)!;
  if (datos.forzada) return datos.forzada;
  return datos.categoria === 'Comida' ? 'Cocina' : `Barra ${ambiente}`;
}

// ---------------------------------------------------------------------------------------------
// El libro de control de cada noche.

interface Libro {
  fecha: string;
  fondo: number;
  precioEntrada: number;
  /** Lo vendido de cada cuenta: sus líneas vigentes al precio del momento. */
  consumo: Map<number, number>;
  /** Claves de envío de los pedidos registrados: un reintento no suma (RN-13). */
  pedidos: Set<string>;
  pagos: Map<string, { cuenta: number; medio: MedioDePago; monto: number; propina: number }>;
  /** Cada entrada registrada, por documento. */
  entradas: Map<string, { forma: FormaDeEntrada; ticket: number | null }>;
  cerradoConSaldo: number;
  /** RNF-03: envíos de pedidos y pagos repetidos tras un corte de red. */
  cortes: number;
  /** OE1: comandas que quedaron listas y las que avisaron al garzón que tomó el pedido. */
  listas: Set<string>;
  avisos: Set<string>;
  /** OE1: llamados registrados y los que vieron solo los garzones de su ambiente. */
  llamados: number;
  llamadosBienAvisados: number;
  /** OE4: acciones fuera del turno o del rol que se probaron y las que se rechazaron. */
  fueraDeTurno: { probadas: number; rechazadas: number };
}

const nuevoLibro = (fecha: string, fondo: number, precioEntrada: number): Libro => ({
  fecha,
  fondo,
  precioEntrada,
  consumo: new Map(),
  pedidos: new Set(),
  pagos: new Map(),
  entradas: new Map(),
  cerradoConSaldo: 0,
  cortes: 0,
  listas: new Set(),
  avisos: new Set(),
  llamados: 0,
  llamadosBienAvisados: 0,
  fueraDeTurno: { probadas: 0, rechazadas: 0 },
});

const pagadoSegunLibro = (libro: Libro, cuenta: number) =>
  suma([...libro.pagos.values()].filter((p) => p.cuenta === cuenta).map((p) => p.monto));

/** OE4: una acción fuera del turno o del rol se prueba y debe rechazarse sin registrar nada. */
async function rechazada(
  libro: Libro,
  accion: () => Promise<unknown>,
  error: RegExp | string | typeof NoAutorizado = NoAutorizado,
) {
  libro.fueraDeTurno.probadas += 1;
  await expect(accion()).rejects.toThrow(error);
  libro.fueraDeTurno.rechazadas += 1;
}

// ---------------------------------------------------------------------------------------------
// La sala: cuentas, pedidos, estaciones y cobros.

type Donde = { mesa: number } | { referencia: string };

async function abrirCuenta(libro: Libro, quien: string, ambiente: string, donde: Donde) {
  const datos =
    'mesa' in donde
      ? { mesaId: await mesaDe(ambiente, donde.mesa) }
      : { ambienteId: ambienteId(ambiente), referencia: donde.referencia };
  const abierta = await cuentas.abrir(await como(quien), datos);
  if (!abierta.existente) libro.consumo.set(abierta.numero, 0);
  return abierta;
}

type LineaSimulada = [producto: string, cantidad: number, nota?: string];

function datosDelPedido(
  cuenta: number,
  lineas: LineaSimulada[],
  personas: number | null,
  claveEnvio = randomUUID(),
) {
  return {
    cuenta,
    claveEnvio,
    personas,
    lineas: lineas.map(([producto, cantidad, nota]) => ({
      productoId: local.producto.get(producto)!.id,
      cantidad,
      nota: nota ?? null,
    })),
  };
}

async function enviarPedido(
  libro: Libro,
  quien: string,
  cuenta: number,
  lineas: LineaSimulada[],
  personas: number | null = null,
  claveEnvio = randomUUID(),
) {
  const datos = datosDelPedido(cuenta, lineas, personas, claveEnvio);
  const enviado = await pedidos.enviar(await como(quien), datos);
  if (!enviado.repetido) {
    libro.pedidos.add(claveEnvio);
    const importe = suma(lineas.map(([p, cantidad]) => local.precio.get(p)! * cantidad));
    libro.consumo.set(cuenta, libro.consumo.get(cuenta)! + importe);
  }
  return enviado;
}

/** HU-22: el garzón anula una línea de la cuenta y el libro deja de contarla. */
async function anularLinea(
  libro: Libro,
  quien: string,
  cuenta: number,
  pedido: number,
  producto: string,
) {
  const detalle = (await cuentas.detalleCuenta(await como(quien), cuenta))!;
  const linea = detalle.pedidos
    .find((p) => p.numero === pedido)!
    .lineas.find((l) => l.producto === producto && !l.anulada)!;
  await pedidos.anular(await como(quien), { cuenta, pedido, linea: linea.linea });
  libro.consumo.set(cuenta, libro.consumo.get(cuenta)! - linea.precioUnitario * linea.cantidad);
}

const llevaComida = (lineas: LineaSimulada[]) =>
  lineas.some(([producto]) => local.producto.get(producto)!.categoria === 'Comida');

const TRAGOS = ['Schop', 'Cerveza en botella', 'Piscola', 'Mojito', 'Pisco sour'];
const SIN_ALCOHOL = ['Bebida', 'Agua mineral', 'Jugo de maracuyá'];
const BOTELLAS = ['Botella de pisco 35°', 'Botella de vodka', 'Botella de espumante'];
const COMIDA = ['Papas fritas', 'Tabla mixta'];
const NOTAS = ['Sin hielo', 'Doble', 'Con limón', 'Alergia al maní', 'Bien helada'];

/** Un pedido como los de una noche: tragos casi siempre, a veces bebidas, botellas o comida. */
function pedidoAlAzar(azar: Azar, disponible: (producto: string) => boolean): LineaSimulada[] {
  const lineas: LineaSimulada[] = [];
  const agregar = (lista: string[], maximo: number) => {
    const opciones = lista.filter(disponible);
    if (opciones.length === 0) return;
    const producto = azar.uno(opciones);
    if (lineas.some(([p]) => p === producto)) return;
    const cantidad = azar.entre(1, maximo);
    lineas.push(azar.si(0.2) ? [producto, cantidad, azar.uno(NOTAS)] : [producto, cantidad]);
  };
  agregar(TRAGOS, 4);
  if (azar.si(0.3)) agregar(SIN_ALCOHOL, 3);
  if (azar.si(0.08)) agregar(BOTELLAS, 1);
  if (azar.si(0.25)) agregar(COMIDA, 2);
  return lineas;
}

interface Marcada {
  pedido: number;
  estacionId: number;
}

const llaveDe = ({ pedido, estacionId }: Marcada) => `${pedido}:${estacionId}`;

/**
 * Barra o cocina marcan listas sus comandas pendientes. Antes se comprueba que cada línea de la cola
 * sea de esa estación según RN-10 (HU-17 CA1 y HU-18 CA1) y que la comida traiga sus personas. Solo
 * cuentan las que esta tablet marcó primero: si la otra tablet de la cocina ya lo hizo, la hora no
 * cambia (HU-19 CA2).
 */
async function prepararEn(libro: Libro, quien: string, tipo: TipoEstacion, estacion?: string) {
  const actor = await como(quien);
  const vista = await colas.cola(actor, tipo, estacion ? estacionId(estacion) : undefined);
  const marcadas: Marcada[] = [];
  if (!vista.estacion) return marcadas;
  for (const comanda of [...vista.pendientes, ...vista.listas]) {
    for (const linea of comanda.lineas) {
      expect(destinoEsperado(linea.producto, comanda.ambiente)).toBe(vista.estacion.nombre);
    }
    if (tipo === 'cocina') expect(comanda.personas).toBeGreaterThan(0); // HU-18 CA2
  }
  for (const comanda of vista.pendientes.filter((c) => !c.anulada)) {
    const { yaEstaba } = await colas.marcarLista(actor, comanda.pedido, vista.estacion.id);
    if (yaEstaba) continue;
    const marcada = { pedido: comanda.pedido, estacionId: vista.estacion.id };
    libro.listas.add(llaveDe(marcada));
    marcadas.push(marcada);
  }
  return marcadas;
}

async function tomadoPor(fecha: string, pedido: number) {
  const [fila] = await consultar<{ correo: string }[]>`
    select u.correo from gesnoc.pedido p join gesnoc.usuario u on u.id = p.tomado_por
    where p.fecha = ${fecha} and p.numero = ${pedido}`;
  return fila!.correo.split('@')[0]!;
}

async function yaEntregada(fecha: string, { pedido, estacionId }: Marcada) {
  const [fila] = await consultar<{ entregada: boolean }[]>`
    select entregada_en is not null as entregada from gesnoc.comanda
    where fecha = ${fecha} and pedido_numero = ${pedido} and estacion_id = ${estacionId}`;
  return fila!.entregada;
}

/**
 * HU-20: cada comanda lista le aparece al garzón que tomó el pedido, con su número y su mesa o
 * referencia (CA1 y CA2). Si ese garzón ya la entregó, el aviso cumplió su función.
 */
async function comprobarAvisos(libro: Libro, marcadas: Marcada[]) {
  for (const marcada of marcadas) {
    const quien = await tomadoPor(libro.fecha, marcada.pedido);
    const { listas } = await colas.misComandas(await como(quien));
    const aviso = listas.find(
      (c) => c.pedido === marcada.pedido && c.estacionId === marcada.estacionId,
    );
    if (aviso) expect(aviso.ubicacion).not.toBe('');
    if (aviso || (await yaEntregada(libro.fecha, marcada))) libro.avisos.add(llaveDe(marcada));
  }
}

/** HU-21: el garzón entrega lo que tiene listo, que es solo de sus pedidos (HU-20 CA1). */
async function entregarListas(libro: Libro, quien: string) {
  const actor = await como(quien);
  const { listas } = await colas.misComandas(actor);
  for (const comanda of listas) {
    expect(await tomadoPor(libro.fecha, comanda.pedido)).toBe(quien);
    await colas.entregar(actor, comanda.pedido, comanda.estacionId);
  }
  return listas.length;
}

/** Barra y cocina preparan todo lo pendiente y cada garzón retira lo suyo. */
async function rondaDeEstaciones(
  libro: Libro,
  estaciones: [quien: string, tipo: TipoEstacion, estacion?: string][],
  garzones: string[],
) {
  const marcadas: Marcada[] = [];
  for (const [quien, tipo, estacion] of estaciones) {
    marcadas.push(...(await prepararEn(libro, quien, tipo, estacion)));
  }
  await comprobarAvisos(libro, marcadas);
  for (const garzon of garzones) await entregarListas(libro, garzon);
  return marcadas;
}

async function pagar(
  libro: Libro,
  quien: string,
  cuenta: number,
  medio: MedioDePago,
  monto: number,
  propina = 0,
  claveEnvio = randomUUID(),
) {
  const hecho = await pagos.cobrar(await como(quien), {
    cuenta,
    claveEnvio,
    medio,
    monto,
    propina,
  });
  if (!hecho.repetido) libro.pagos.set(claveEnvio, { cuenta, medio, monto, propina });
  return hecho;
}

type FormaDeCobro = 'saldo' | 2 | 3 | 4 | 'items' | 'libre';
const FORMAS_DE_COBRO: FormaDeCobro[] = ['saldo', 2, 3, 4, 'items', 'libre'];
const MEDIOS: MedioDePago[] = ['efectivo', 'tarjeta', 'transferencia'];
const PROPINAS: FormaDePropina[] = ['sin', 10, 15, 30];

/**
 * El cobro completo de una cuenta, como en la pantalla «Cobrar» (HU-24 y HU-25): el saldo de una
 * vez, partes iguales, los ítems de alguien o un monto libre, cada abono con su medio y su propina.
 * Antes de cobrar se controla que el saldo del teléfono sea lo vendido según el libro. Con `corte`,
 * la respuesta del primer abono se pierde y el teléfono lo reenvía con la misma clave (RNF-03).
 */
async function cobrarCuenta(
  libro: Libro,
  quien: string,
  cuenta: number,
  forma: FormaDeCobro,
  azar: Azar,
  corte = false,
) {
  const detalle = (await cuentas.detalleCuenta(await como(quien), cuenta))!;
  expect(detalle.saldo).toBe(libro.consumo.get(cuenta)! - pagadoSegunLibro(libro, cuenta));
  let saldo = detalle.saldo;
  let pagadas = 0;
  while (saldo > 0) {
    let monto = saldo;
    if (typeof forma === 'number') monto = partePorPersona(saldo, forma - pagadas);
    if (forma === 'items' && pagadas === 0) {
      const linea = detalle.pedidos.flatMap((p) => p.lineas).find((l) => !l.anulada)!;
      const clave = String(linea.linea);
      monto = Math.min(saldo, montoDeItems([{ ...linea, clave }], { [clave]: linea.cantidad }));
    }
    if (forma === 'libre' && pagadas === 0) monto = Math.min(saldo, 10_000);
    const medio = azar.uno(MEDIOS);
    const propina = propinaDe(azar.uno(PROPINAS), '', monto);
    const clave = randomUUID();
    const hecho = await pagar(libro, quien, cuenta, medio, monto, propina, clave);
    if (corte && pagadas === 0) {
      const reintento = await pagar(libro, quien, cuenta, medio, monto, propina, clave);
      expect(reintento).toEqual({ ...hecho, repetido: true });
      libro.cortes += 1;
    }
    expect(hecho.saldo).toBe(saldo - monto);
    saldo = hecho.saldo;
    pagadas += 1;
    expect(hecho.cerrada).toBe(saldo === 0); // HU-24 CA3
  }
}

// ---------------------------------------------------------------------------------------------
// La puerta.

interface Visitante {
  documento: string;
  tipo: 'rut' | 'extranjero';
  nombre: string;
  apellido: string;
  forma: FormaDeEntrada;
  /** Como lo digita el guardia, si no es el documento normalizado. */
  digitado?: string;
}

const NOMBRES = ['Camila', 'Benjamín', 'Antonia', 'Vicente', 'Florencia', 'Matías', 'Josefa'];
const APELLIDOS = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva'];

function visitante(azar: Azar, cuerpo: number, forma: FormaDeEntrada): Visitante {
  return {
    documento: rut(cuerpo),
    tipo: 'rut',
    nombre: azar.uno(NOMBRES),
    apellido: azar.uno(APELLIDOS),
    forma,
  };
}

function formaAlAzar(azar: Azar): FormaDeEntrada {
  const x = azar.entre(1, 100);
  if (x <= 55) return 'efectivo';
  if (x <= 85) return 'tarjeta';
  if (x <= 95) return 'pendiente';
  return 'gratis';
}

/**
 * HU-30: el guardia busca el documento y registra la entrada como en la pantalla «Puerta». El
 * documento pasa por el mismo esquema que la ruta, que lo valida y lo normaliza (RN-21).
 */
async function registrarEntrada(libro: Libro, quien: string, persona: Visitante) {
  const actor = await como(quien);
  const datos = datosEntrada.parse({
    tipoDocumento: persona.tipo,
    documento: persona.digitado ?? persona.documento,
    nombre: persona.nombre,
    apellido: persona.apellido,
    forma: persona.forma,
    monto: persona.forma === 'gratis' ? 0 : libro.precioEntrada,
  });
  expect(datos.documento).toBe(persona.documento);
  const busqueda = await puerta.buscar(actor, datos.documento);
  const hecho = await puerta.registrar(actor, datos);
  if (!hecho.repetida) {
    expect(libro.entradas.has(hecho.documento)).toBe(false);
    libro.entradas.set(hecho.documento, { forma: hecho.forma, ticket: hecho.ticket });
  }
  return { busqueda, hecho };
}

// ---------------------------------------------------------------------------------------------
// La caja y el cierre.

/** RN-19, calculado con el libro y sin pasar por el sistema: el cálculo de control de OE2. */
function esperadoSegunLibro(libro: Libro) {
  const efectivo = [...libro.pagos.values()].filter((p) => p.medio === 'efectivo');
  const entradasEnEfectivo = [...libro.entradas.values()].filter((e) => e.forma === 'efectivo');
  return (
    libro.fondo +
    suma(efectivo.map((p) => p.monto + p.propina)) +
    entradasEnEfectivo.length * libro.precioEntrada
  );
}

/** HU-26: la administración confirma exactamente el efectivo que tiene a la vista. */
async function confirmarTodoElEfectivo(admin: Actor) {
  const { garzones } = await caja.pantallaEfectivo(admin);
  const vistos = garzones.flatMap((g) => g.pagos.map(({ cuenta, numero }) => ({ cuenta, numero })));
  const { confirmados } = await caja.confirmarEfectivo(admin, vistos);
  expect(confirmados).toBe(vistos.length);
}

/**
 * Lo que se comprueba de cada noche cerrada: los indicadores de OE1 a OE4 y que el resumen, el
 * arqueo y los indicadores digan lo mismo que el libro (HU-29 CA2).
 */
async function comprobarNoche(libro: Libro) {
  const admin = await como('admin');

  // OE1: el 100 % de los ítems fue a la estación correcta (RN-10).
  const lineas = await consultar<{ producto: string; estacion: string; ambiente: string }[]>`
    select pr.nombre as producto, e.nombre as estacion, a.nombre as ambiente
    from gesnoc.detalle_pedido d
    join gesnoc.producto pr on pr.id = d.producto_id
    join gesnoc.estacion e on e.id = d.estacion_id
    join gesnoc.pedido p on p.fecha = d.fecha and p.numero = d.pedido_numero
    join gesnoc.cuenta c on c.fecha = p.fecha and c.numero = p.cuenta_numero
    left join gesnoc.mesa m on m.id = c.mesa_id
    join gesnoc.ambiente a on a.id = coalesce(c.ambiente_id, m.ambiente_id)
    where d.fecha = ${libro.fecha}`;
  const malRuteadas = lineas.filter((l) => destinoEsperado(l.producto, l.ambiente) !== l.estacion);
  expect(malRuteadas).toEqual([]);
  // RN-13: cada pedido enviado quedó una vez, aunque el teléfono lo reenviara.
  expect(await cuantos('pedido', libro.fecha)).toBe(libro.pedidos.size);
  // OE1: cada comanda lista generó su aviso al garzón que tomó el pedido.
  expect([...libro.listas].filter((l) => !libro.avisos.has(l))).toEqual([]);
  expect(libro.llamadosBienAvisados).toBe(libro.llamados);
  expect(await cuantos('llamado', libro.fecha)).toBe(libro.llamados);

  // OE2: ningún pago se registró dos veces ni superó el consumo de su cuenta.
  expect(await cuantos('pago', libro.fecha)).toBe(libro.pagos.size);
  const excedidas = await consultar<{ numero: number }[]>`
    select c.numero from gesnoc.cuenta c
    where c.fecha = ${libro.fecha}
      and (select coalesce(sum(monto), 0) from gesnoc.pago p
           where p.fecha = c.fecha and p.cuenta_numero = c.numero)
        > (select coalesce(sum(d.cantidad * d.precio_unitario), 0)
           from gesnoc.pedido p
           join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
           where p.fecha = c.fecha and p.cuenta_numero = c.numero and d.anulado_en is null)`;
  expect(excedidas).toEqual([]);

  // HU-29: lo vendido, lo cobrado por medio y las propinas coinciden con el libro y con el arqueo.
  const { detalle } = await caja.ventasYPropinas(admin, libro.fecha);
  const vendido = suma([...libro.consumo.values()]);
  const cobrado = suma([...libro.pagos.values()].map((p) => p.monto));
  expect(detalle!.totales).toEqual({
    vendido,
    cobrado,
    propinas: suma([...libro.pagos.values()].map((p) => p.propina)),
    porCobrar: 0,
    cerradoConSaldo: libro.cerradoConSaldo,
  });
  expect(vendido).toBe(cobrado + libro.cerradoConSaldo);
  for (const medio of MEDIOS) {
    const delLibro = [...libro.pagos.values()].filter((p) => p.medio === medio);
    const registrado = detalle!.medios.find((m) => m.medio === medio);
    expect(registrado?.monto ?? 0).toBe(suma(delLibro.map((p) => p.monto)));
  }
  expect(detalle!.esperado!.total).toBe(esperadoSegunLibro(libro)); // OE2: cálculo de control

  // OE3: sin ingresos duplicados ni tickets repetidos o salteados; solo las pagadas llevan ticket.
  const entradas = await consultar<{ documento: string; ticket: number | null; medio: string }[]>`
    select c.documento, e.ticket, coalesce(e.medio_pago, 'gratis') as medio
    from gesnoc.entrada e join gesnoc.cliente c on c.id = e.cliente_id
    where e.fecha = ${libro.fecha}`;
  expect(entradas).toHaveLength(libro.entradas.size);
  const tickets = entradas
    .flatMap((e) => (e.ticket === null ? [] : [e.ticket]))
    .sort((a, b) => a - b);
  expect(tickets).toEqual(tickets.map((_, i) => i + 1));
  for (const entrada of entradas) {
    expect(entrada.ticket === null).toBe(entrada.medio === 'gratis'); // RN-22
  }
  // OE3: cada sorteo premió un ticket pagado de la noche, y lo hizo un guardia o la administración.
  const sorteos = await consultar<{ ticket: number; rol: string | null; admin: boolean }[]>`
    select s.ticket_ganador as ticket, a.rol, u.es_administrador as admin
    from gesnoc.sorteo s
    join gesnoc.usuario u on u.id = s.realizado_por
    left join gesnoc.asignacion a on a.fecha = s.fecha and a.usuario_id = u.id
    where s.fecha = ${libro.fecha}`;
  for (const ganador of sorteos) {
    expect(tickets).toContain(ganador.ticket);
    expect(ganador.admin || ganador.rol === 'guardia').toBe(true); // HU-37 CA2
  }
  const { detalle: panel } = await indicadoresDeLaNoche(admin, libro.fecha);
  expect(panel!.ingresos).toBe(libro.entradas.size);

  // OE4: el 100 % de las acciones fuera del turno o del rol se rechazó.
  expect(libro.fueraDeTurno.rechazadas).toBe(libro.fueraDeTurno.probadas);

  const [noche] = await consultar<{ cerrada: boolean }[]>`
    select cerrada_en is not null as cerrada from gesnoc.noche where fecha = ${libro.fecha}`;
  expect(noche!.cerrada).toBe(true);

  return {
    noche: libro.fecha,
    pedidos: libro.pedidos.size,
    lineas: lineas.length,
    comandasListas: libro.listas.size,
    llamados: libro.llamados,
    pagos: libro.pagos.size,
    cortesDeRed: libro.cortes,
    vendido,
    cobrado,
    cerradoConSaldo: libro.cerradoConSaldo,
    ingresos: libro.entradas.size,
    tickets: tickets.length,
    sorteos: sorteos.length,
    esperado: detalle!.esperado!.total,
    contado: detalle!.conteo!.contado,
    fueraDeTurno: libro.fueraDeTurno.probadas,
  };
}

/** RN-26: después del cierre nada se registra en la noche y el personal pierde su turno. */
async function comprobarNocheCerrada(libro: Libro, cuenta: number, codigoMesa: string) {
  const garzon = await como('garzon');
  expect(garzon.turno).toBeNull();
  expect(inicioDe(garzon)).toBe('/personal');
  const admin = await como('admin');
  const sinNoche = 'No hay una noche abierta';
  await expect(pedidos.enviar(admin, datosDelPedido(cuenta, [['Schop', 1]], null))).rejects.toThrow(
    sinNoche,
  );
  await expect(
    pagos.cobrar(admin, {
      cuenta,
      claveEnvio: randomUUID(),
      medio: 'tarjeta',
      monto: 1000,
      propina: 0,
    }),
  ).rejects.toThrow(sinNoche);
  await expect(
    puerta.registrar(
      admin,
      datosEntrada.parse({
        tipoDocumento: 'rut',
        documento: rut(9_000_001),
        nombre: 'Tarde',
        apellido: 'Llegada',
        forma: 'efectivo',
        monto: libro.precioEntrada,
      }),
    ),
  ).rejects.toThrow(sinNoche);
  await expect(llamados.llamar(codigoMesa)).rejects.toThrow(llamados.LOCAL_SIN_ATENCION);
  await expect(
    noches.editar(admin, { fecha: libro.fecha, nota: 'Cambio tardío', precioEntrada: 1 }),
  ).rejects.toThrow('Una noche cerrada no admite cambios');
  await expect(detalles.agregarEvento(admin, libro.fecha, 'Show tardío', null)).rejects.toThrow(
    'Una noche cerrada no admite cambios',
  );
}

async function asignar(
  fecha: string,
  clave: string,
  rol: RolTurno,
  ambiente: string | null,
  confirmarSinDisponibilidad = false,
) {
  await turnos.asignar(await como('admin'), {
    fecha,
    usuarioId: personaId(clave),
    rol,
    ambienteId: ambiente ? ambienteId(ambiente) : null,
    confirmarSinDisponibilidad,
  });
}

/**
 * Un equipo de un ambiente durante la noche: el garzón recorre sus mesas y un cliente de pie, abre
 * cuentas, envía pedidos, la barra y la cocina preparan, el garzón entrega y cobra las cuentas que
 * llegan a su consumo. Cada cierto número de pedidos se corta la red (RNF-03 y EV-05).
 */
function crearEquipo(
  libro: Libro,
  garzon: string,
  barman: string,
  ambiente: 'Salón' | 'Terraza',
  mesas: number[],
  azar: Azar,
  agotados: Set<string>,
) {
  const abiertas = new Map<string, { cuenta: number; pedidos: number; objetivo: number }>();
  const lugares: { clave: string; donde: Donde }[] = [
    ...mesas.map((mesa) => ({ clave: `mesa ${mesa}`, donde: { mesa } })),
    { clave: 'de pie', donde: { referencia: `Chaqueta verde (${ambiente})` } },
  ];
  const otro = garzon === 'garzon' ? 'garzon2' : 'garzon';
  let enviados = 0;
  let cobradas = 0;

  async function enviarAlgo(cuenta: number) {
    const lineas = pedidoAlAzar(azar, (producto) => !agotados.has(producto));
    const personas = llevaComida(lineas) ? azar.entre(1, 6) : null;
    if (enviados % 31 === 7) {
      // La respuesta no llega y el teléfono reenvía el pedido con la misma clave (RN-13).
      const clave = randomUUID();
      const primero = await enviarPedido(libro, garzon, cuenta, lineas, personas, clave);
      const reintento = await enviarPedido(libro, garzon, cuenta, lineas, personas, clave);
      expect(reintento).toEqual({ ...primero, repetido: true });
      libro.cortes += 1;
    } else if (enviados % 31 === 19) {
      // El reintento sale antes de que termine el primero: espera y devuelve el mismo pedido.
      const clave = randomUUID();
      const ambos = await Promise.all([
        enviarPedido(libro, garzon, cuenta, lineas, personas, clave),
        enviarPedido(libro, garzon, cuenta, lineas, personas, clave),
      ]);
      expect(ambos.map((p) => p.repetido).sort()).toEqual([false, true]);
      expect(ambos[0]!.numero).toBe(ambos[1]!.numero);
      libro.cortes += 1;
    } else {
      await enviarPedido(libro, garzon, cuenta, lineas, personas);
    }
    enviados += 1;
  }

  return {
    async atender(meta: number) {
      const hasta = enviados + meta;
      while (enviados < hasta) {
        for (const lugar of lugares) {
          if (enviados >= hasta) break;
          let abierta = abiertas.get(lugar.clave);
          if (!abierta) {
            const { numero } = await abrirCuenta(libro, garzon, ambiente, lugar.donde);
            abierta = { cuenta: numero, pedidos: 0, objetivo: azar.entre(3, 9) };
            abiertas.set(lugar.clave, abierta);
          }
          await enviarAlgo(abierta.cuenta);
          abierta.pedidos += 1;
        }
        await rondaDeEstaciones(
          libro,
          [
            [barman, 'barra'],
            ['cocina', 'cocina'],
          ],
          [garzon],
        );
        for (const [lugar, abierta] of abiertas) {
          if (abierta.pedidos < abierta.objetivo) continue;
          if (cobradas % 7 === 0) {
            // RN-14: el garzón del otro ambiente no pide ni cobra en esta cuenta.
            await rechazada(libro, () => pagar(libro, otro, abierta.cuenta, 'tarjeta', 1000));
            await rechazada(libro, () =>
              enviarPedido(libro, otro, abierta.cuenta, [['Bebida', 1]]),
            );
          }
          if (cobradas % 7 === 3) {
            // RN-18: ningún pago supera el saldo, y no se registra nada.
            await rechazada(
              libro,
              () => pagar(libro, garzon, abierta.cuenta, 'tarjeta', 9_999_999),
              /El monto supera el saldo de \$/,
            );
          }
          cobradas += 1;
          const forma = azar.uno(FORMAS_DE_COBRO);
          await cobrarCuenta(libro, garzon, abierta.cuenta, forma, azar, cobradas % 5 === 0);
          abiertas.delete(lugar);
        }
      }
    },
    abiertas: () => [...abiertas.values()].map((a) => a.cuenta),
  };
}

const resumenes: Awaited<ReturnType<typeof comprobarNoche>>[] = [];

// =============================================================================================

describe('Tres noches completas, de la programación al cierre', () => {
  beforeAll(async () => {
    await vaciar(consultar);
    await sembrar(consultar, CLAVE, SIEMBRA);
    await leerLocal();
    for (const clave of local.persona.keys()) await ingresar(clave);

    // Historia de hace un año: Rodrigo vino una sola vez y lo reportaron; Valentina, en enero. Sus
    // datos se conservan mientras tengan una visita en los últimos 12 meses (RN-25).
    await consultar`
      insert into gesnoc.noche (fecha, nota, precio_entrada, abierta_en, cerrada_en)
      values (${HACE_UN_ANO}, null, 5000, ${`${HACE_UN_ANO} 22:00:00-03`},
              ${`${HACE_UN_ANO} 22:00:00-03`}::timestamptz + interval '7 hours'),
             ('2026-01-15', null, 5000, '2026-01-15 22:00:00-03', '2026-01-16 05:00:00-03')`;
    const [rodrigo] = await consultar<{ id: number }[]>`
      insert into gesnoc.cliente (documento, nombre, apellido)
      values (${rut(11_111_112)}, 'Rodrigo', 'Antiguo') returning id`;
    const [valentina] = await consultar<{ id: number }[]>`
      insert into gesnoc.cliente (documento, nombre, apellido)
      values (${rut(12_222_223)}, 'Valentina', 'Reciente') returning id`;
    await consultar`
      insert into gesnoc.entrada (fecha, cliente_id, monto, medio_pago, ticket, registrada_por)
      values (${HACE_UN_ANO}, ${rodrigo!.id}, 5000, 'efectivo', 1, ${personaId('guardia')}),
             ('2026-01-15', ${valentina!.id}, 5000, 'tarjeta', 1, ${personaId('guardia')})`;
    await consultar`
      insert into gesnoc.reporte (cliente_id, numero, fecha, tipo, descripcion, registrado_por)
      values (${rodrigo!.id}, 1, ${HACE_UN_ANO}, 'advertencia',
              'Discutió con el guardia en la fila', ${personaId('guardia')})`;
    await consultar`
      insert into gesnoc.lista (fecha, numero, nombre, responsable, gratis)
      values (${HACE_UN_ANO}, 1, 'Cumpleaños de Rodrigo', 'Rodrigo Antiguo', false)`;
    await consultar`
      insert into gesnoc.invitacion (fecha, documento, nombre, apellido, invitado_por, gratis)
      values (${HACE_UN_ANO}, ${rut(13_333_334)}, 'Amigo', 'Del DJ', 'DJ de esa noche', true)`;

    // La administración publica las noches de la semana (HU-08).
    const admin = await como('admin');
    await noches.programar(admin, {
      fecha: JUEVES,
      nota: 'Jueves de karaoke',
      precioEntrada: 3000,
    });
    await noches.programar(admin, {
      fecha: VIERNES,
      nota: 'Viernes de reggaetón',
      precioEntrada: 5000,
    });
    await noches.programar(admin, { fecha: SABADO, nota: 'Sábado de cumbia', precioEntrada: 7000 });
    await expect(
      noches.programar(admin, { fecha: JUEVES, nota: null, precioEntrada: 0 }),
    ).rejects.toThrow('Esa noche ya está programada');
  }, PLAZO);

  // ===========================================================================================
  it(
    'Jueves: una noche tranquila de punta a punta, solo con el Salón',
    async () => {
      const azar = azarCon(3);
      const libro = nuevoLibro(JUEVES, 50_000, 3000);
      const admin = await como('admin');

      // --- Detalles de la noche (HU-34) ---
      await detalles.elegirPremio(admin, {
        fecha: JUEVES,
        ambienteId: ambienteId('Salón'),
        items: [{ productoId: local.producto.get('Botella de pisco 35°')!.id, cantidad: 1 }],
      });
      await detalles.agregarEvento(admin, JUEVES, 'Karaoke abierto', '23:30');
      await detalles.guardarLista(admin, {
        fecha: JUEVES,
        numero: null,
        nombre: 'Cumpleaños de Sofía',
        responsable: 'Sofía Morales',
        gratis: false,
      });
      const cumpleanos = [rut(15_000_001), rut(15_000_002), rut(15_000_003)];
      for (const [i, documento] of cumpleanos.entries()) {
        await detalles.invitar(
          admin,
          datosInvitacion.parse({
            fecha: JUEVES,
            documento,
            nombre: `Amiga ${i + 1}`,
            apellido: 'De Sofía',
            listaNumero: 1,
          }),
        );
      }
      const delDj = rut(15_000_004);
      await detalles.invitar(
        admin,
        datosInvitacion.parse({
          fecha: JUEVES,
          documento: delDj,
          nombre: 'Tomás',
          apellido: 'Invitado',
          invitadoPor: 'DJ de la noche',
          gratis: 'on',
        }),
      );

      // --- Postulaciones (HU-09): solo a noches programadas que no se abren (RN-03) ---
      for (const clave of ['garzon', 'barra', 'cocina', 'guardia', 'sinturno']) {
        await turnos.declararDisponibilidad(await como(clave), JUEVES, true);
      }
      await expect(
        turnos.declararDisponibilidad(await como('garzon'), '2026-11-17', true),
      ).rejects.toThrow('Solo puedes declararte disponible en noches programadas');

      // --- Asignación (HU-10, CU-09) ---
      await asignar(JUEVES, 'garzon', 'garzon', 'Salón');
      await asignar(JUEVES, 'barra', 'barman', 'Salón');
      await asignar(JUEVES, 'cocina', 'cocinero', null);
      await asignar(JUEVES, 'guardia', 'guardia', null);
      // CA2 y 3a: a quien no postuló se le asigna solo si la administración lo confirma.
      await expect(asignar(JUEVES, 'apoyo', 'guardia', null)).rejects.toThrow(
        'Esta persona no declaró disponibilidad: confirma para asignarla',
      );
      await asignar(JUEVES, 'apoyo', 'guardia', null, true);
      // CA1 y 4b (RN-04): la cocina no lleva ambiente y el garzón sí.
      await expect(asignar(JUEVES, 'sinturno', 'cocinero', 'Salón')).rejects.toThrow(
        'Garzón y barra llevan ambiente; cocina y guardia no',
      );
      await expect(asignar(JUEVES, 'sinturno', 'garzon', null)).rejects.toThrow(
        'Garzón y barra llevan ambiente; cocina y guardia no',
      );
      // CA3: el turno aparece en el calendario de la persona con su rol y su ambiente.
      const suyos = await turnos.misTurnos(await como('garzon'));
      expect(suyos.find((t) => t.fecha === JUEVES)).toEqual(
        expect.objectContaining({ rol: 'garzon', ambiente: 'Salón', disponible: true }),
      );

      // --- Antes de abrir nadie opera: solo su calendario (RN-05) ---
      expect(inicioDe(await como('garzon'))).toBe('/personal');
      await rechazada(libro, async () =>
        cuentas.abrir(await como('garzon'), { mesaId: await mesaDe('Salón', 1) }),
      );

      // --- Apertura (HU-11): una sola noche abierta (RN-02) ---
      await noches.abrir(admin, JUEVES, libro.fondo);
      await expect(noches.abrir(admin, VIERNES, 10_000)).rejects.toThrow(
        'Ya hay una noche abierta',
      );

      // RF-04: cada persona llega a la pantalla del rol de su turno; sin turno, a su calendario.
      const claves = ['admin', 'garzon', 'barra', 'cocina', 'guardia', 'apoyo', 'sinturno'];
      const destinos = await Promise.all(
        [...claves, 'garzon2'].map(async (clave) => inicioDe(await como(clave))),
      );
      expect(destinos).toEqual([
        '/admin',
        '/garzon',
        '/barra',
        '/cocina',
        '/guardia',
        '/guardia',
        '/personal',
        '/personal',
      ]);

      // --- La puerta: 25 personas desde dos teléfonos (HU-30, HU-33) ---
      const fila: Visitante[] = [];
      for (let i = 0; i < 20; i++) {
        fila.push(visitante(azar, 20_000_000 + i * 7, formaAlAzar(azar)));
      }
      fila[3] = { ...fila[3]!, forma: 'gratis' };
      for (const [i, documento] of cumpleanos.entries()) {
        fila.push({
          documento,
          tipo: 'rut',
          nombre: `Amiga ${i + 1}`,
          apellido: 'De Sofía',
          forma: 'efectivo',
        });
      }
      fila.push({
        documento: delDj,
        tipo: 'rut',
        nombre: 'Tomás',
        apellido: 'Invitado',
        forma: 'gratis',
        digitado: conPuntos(delDj),
      });
      fila.push({
        documento: 'AB123456',
        tipo: 'extranjero',
        nombre: 'Lucas',
        apellido: 'Ferreira',
        forma: 'tarjeta',
        digitado: 'ab 123 456',
      });
      const recorrer = async (quien: string, personas: Visitante[]) => {
        const hechos = [];
        for (const persona of personas) hechos.push(await registrarEntrada(libro, quien, persona));
        return hechos;
      };
      const mitad = Math.ceil(fila.length / 2);
      const resultados = (
        await Promise.all([
          recorrer('guardia', fila.slice(0, mitad)),
          recorrer('apoyo', fila.slice(mitad)),
        ])
      ).flat();
      // HU-33 CA1: la lista que paga y el invitado del DJ aparecen al buscar, con lo que les toca.
      for (const { busqueda } of resultados) {
        if (cumpleanos.includes(busqueda.documento)) {
          expect(busqueda.invitacion).toMatchObject({
            lista: 'Cumpleaños de Sofía',
            gratis: false,
          });
        }
        if (busqueda.documento === delDj) {
          expect(busqueda.invitacion).toMatchObject({
            invitadoPor: 'DJ de la noche',
            gratis: true,
          });
        }
      }
      // CA2: el invitado gratis entra sin ticket ni medio de pago.
      expect(libro.entradas.get(delDj)).toEqual({ forma: 'gratis', ticket: null });
      // CU-23 5a: quien ya entró no entra de nuevo; se muestran su hora y su ticket.
      const repetido = await registrarEntrada(libro, 'apoyo', fila[0]!);
      expect(repetido.hecho).toMatchObject({
        repetida: true,
        ticket: libro.entradas.get(fila[0]!.documento)!.ticket,
      });
      expect(repetido.busqueda.entrada).not.toBeNull();
      // HU-32: los dos guardias ven quiénes entraron y el último ticket, pero no lo recaudado.
      for (const clave of ['guardia', 'apoyo']) {
        const estado = await puerta.ingresosDeLaNoche(await como(clave));
        expect(estado.ingresos).toHaveLength(libro.entradas.size);
        expect(estado.ultimoTicket).toBe(
          Math.max(...[...libro.entradas.values()].map((e) => e.ticket ?? 0)),
        );
        expect(JSON.stringify(estado.ingresos)).not.toMatch(/monto|recaudado/);
      }
      await rechazada(libro, async () => caja.pantallaArqueo(await como('guardia')));

      // --- La sala (HU-13 a HU-23): cinco mesas y un cliente de pie ---
      const abiertas: number[] = [];
      for (const mesa of [1, 2, 3, 4, 5]) {
        abiertas.push((await abrirCuenta(libro, 'garzon', 'Salón', { mesa })).numero);
      }
      const dePie = await abrirCuenta(libro, 'garzon', 'Salón', { referencia: 'Polera roja' });
      abiertas.push(dePie.numero);
      // HU-14 CA1 (RN-06): la mesa ocupada muestra su cuenta, no abre otra.
      expect(await abrirCuenta(libro, 'garzon', 'Salón', { mesa: 2 })).toEqual({
        numero: abiertas[1],
        existente: true,
      });
      // RN-14: la Terraza no es de su turno.
      await rechazada(libro, () => abrirCuenta(libro, 'garzon', 'Terraza', { mesa: 1 }));
      // HU-13 CA1: el mapa muestra ocupadas las cinco mesas, y la de pie va aparte.
      const mapa = await cuentas.mapa(await como('garzon'));
      expect(mapa.mesas.filter((m) => m.cuenta !== null).map((m) => m.numero)).toEqual([
        1, 2, 3, 4, 5,
      ]);
      expect(mapa.dePie).toHaveLength(1);

      // RN-12: la comida sin el número de personas no se envía y no se registra nada.
      await expect(
        enviarPedido(libro, 'garzon', abiertas[0]!, [['Papas fritas', 1]], null),
      ).rejects.toThrow('Indica el número de personas: la cocina lo necesita');
      // HU-16, escenario «Pedido mixto»: dos cervezas y una tabla van a dos estaciones.
      const mixto = await enviarPedido(
        libro,
        'garzon',
        abiertas[3]!,
        [
          ['Cerveza en botella', 2],
          ['Tabla mixta', 1],
        ],
        4,
      );
      expect(mixto.estaciones.sort()).toEqual(['Barra Salón', 'Cocina']);
      for (let i = 0; i < 24; i++) {
        const lineas = pedidoAlAzar(azar, () => true);
        const cuenta = abiertas[i % abiertas.length]!;
        await enviarPedido(libro, 'garzon', cuenta, lineas, llevaComida(lineas) ? 3 : null);
      }

      // Barra y cocina preparan; el garzón recibe los avisos (HU-17 a HU-20).
      const marcadas = [
        ...(await prepararEn(libro, 'barra', 'barra')),
        ...(await prepararEn(libro, 'cocina', 'cocina')),
      ];
      await comprobarAvisos(libro, marcadas);
      // HU-19 CA2: si otro dispositivo de la estación ya la marcó, la hora no cambia.
      const primera = marcadas[0]!;
      const horaDe = async () => {
        const [fila] = await consultar<{ lista_en: Date }[]>`
          select lista_en from gesnoc.comanda
          where fecha = ${JUEVES} and pedido_numero = ${primera.pedido}
            and estacion_id = ${primera.estacionId}`;
        return fila!.lista_en;
      };
      const antes = await horaDe();
      const quienMarca = primera.estacionId === estacionId('Cocina') ? 'cocina' : 'barra';
      expect(
        await colas.marcarLista(await como(quienMarca), primera.pedido, primera.estacionId),
      ).toMatchObject({ yaEstaba: true });
      expect(await horaDe()).toEqual(antes);
      // RN-14: la barra no marca la cocina, ni la cocina la barra.
      await rechazada(libro, async () =>
        colas.marcarLista(await como('barra'), mixto.numero, estacionId('Cocina')),
      );
      await rechazada(libro, async () =>
        colas.marcarLista(await como('cocina'), mixto.numero, estacionId('Barra Salón')),
      );
      // HU-21: el garzón entrega todo lo que quedó listo.
      expect(await entregarListas(libro, 'garzon')).toBe(marcadas.length);

      // HU-21 CA1: no se entrega lo que no está listo.
      const tarde = await enviarPedido(libro, 'garzon', dePie.numero, [['Pisco sour', 2]]);
      await expect(
        colas.entregar(await como('garzon'), tarde.numero, estacionId('Barra Salón')),
      ).rejects.toThrow('La comanda aún no está lista');
      await rondaDeEstaciones(libro, [['barra', 'barra']], ['garzon']);

      // HU-22: un ítem mal ingresado se anula antes de cobrar; la barra lo ve tachado (CA2).
      const conError = await enviarPedido(libro, 'garzon', abiertas[4]!, [
        ['Mojito', 1],
        ['Agua mineral', 1],
      ]);
      await anularLinea(libro, 'garzon', abiertas[4]!, conError.numero, 'Mojito');
      const colaBarra = await colas.cola(await como('barra'), 'barra');
      const tachada = colaBarra.pendientes
        .find((c) => c.pedido === conError.numero)!
        .lineas.find((l) => l.producto === 'Mojito')!;
      expect(tachada.anulada).toBe(true);
      await rondaDeEstaciones(libro, [['barra', 'barra']], ['garzon']);
      // HU-23 CA2: lo anulado no suma al total.
      const conAnulado = (await cuentas.detalleCuenta(await como('garzon'), abiertas[4]!))!;
      expect(conAnulado.total).toBe(libro.consumo.get(abiertas[4]!));

      // --- La carta y los llamados (HU-38 a HU-40, RN-29) ---
      const codigoMesa2 = await codigoDe(await mesaDe('Salón', 2));
      expect(await llamados.llamar(codigoMesa2)).toEqual({ avisado: true });
      expect(await llamados.llamar(codigoMesa2)).toEqual({ avisado: true }); // CA2: no crea otro
      libro.llamados += 1;
      const delSalon = (await colas.misComandas(await como('garzon'))).llamados;
      expect(delSalon.map((l) => l.mesa)).toEqual([2]);
      libro.llamadosBienAvisados += 1;
      await llamados.atender(await como('garzon'), delSalon[0]!.numero);
      // CU-28 2b: antes de 60 s se le informa al cliente y no se registra otro.
      await expect(llamados.llamar(codigoMesa2)).rejects.toThrow(/puedes volver a llamarlo en/);
      // La Terraza no atiende el jueves: su llamado lo ve solo la administración.
      await llamados.llamar(await codigoDe(await mesaDe('Terraza', 1)));
      libro.llamados += 1;
      expect((await colas.misComandas(await como('garzon'))).llamados).toEqual([]);
      const enTodoElLocal = (await colas.misComandas(admin)).llamados;
      expect(enTodoElLocal.map((l) => l.ambiente)).toEqual(['Terraza']);
      libro.llamadosBienAvisados += 1;
      await llamados.atender(admin, enTodoElLocal[0]!.numero);

      // --- El cobro (HU-24, HU-25), con cada forma de dividir la cuenta ---
      const formas: FormaDeCobro[] = ['saldo', 2, 3, 'items', 'libre', 4];
      for (const [i, cuenta] of abiertas.entries()) {
        await cobrarCuenta(libro, 'garzon', cuenta, formas[i]!, azar, i === 0);
      }
      const libres = (await cuentas.mapa(await como('garzon'))).mesas;
      expect(libres.every((m) => m.cuenta === null)).toBe(true); // HU-24 CA3
      // CU-18 4b: una cuenta cerrada no recibe más pagos.
      await expect(pagar(libro, 'garzon', abiertas[0]!, 'tarjeta', 1000)).rejects.toThrow(
        'La cuenta ya está cerrada',
      );

      // --- El sorteo (HU-37): el Salón sortea; la Terraza no tiene premio ---
      await rechazada(libro, async () => sorteo.sortear(await como('garzon'), ambienteId('Salón')));
      const ganador = await sorteo.sortear(await como('guardia'), ambienteId('Salón'));
      expect(ganador.premio).toBe('1 × Botella de pisco 35°');
      await expect(sorteo.sortear(await como('guardia'), ambienteId('Terraza'))).rejects.toThrow(
        'Este ambiente no tiene premio',
      );

      // --- El cierre (HU-26, HU-28, HU-12) ---
      await expect(caja.cerrarNoche(admin, JUEVES)).rejects.toThrow(/la caja sin contar$/);
      await confirmarTodoElEfectivo(admin);
      const arqueo = await caja.pantallaArqueo(admin);
      expect(arqueo.esperado!.total).toBe(esperadoSegunLibro(libro)); // OE2
      // Cuadra exacto: no hace falta nota.
      expect(await caja.contar(admin, arqueo.esperado!.total, null)).toMatchObject({
        diferencia: 0,
      });
      expect((await caja.estadoDelCierre(admin))!.pendientes).toEqual({
        cuentasAbiertas: 0,
        efectivoSinConfirmar: 0,
        sinContar: false,
      });
      expect((await resumenDeLaNoche(admin)).noche).toBe(JUEVES);
      // Rodrigo vino hace menos de 12 meses: todavía no se anonimiza.
      expect(await caja.cerrarNoche(admin, JUEVES)).toEqual({ anonimizados: 0 });

      resumenes.push(await comprobarNoche(libro));
      await comprobarNocheCerrada(libro, abiertas[0]!, codigoMesa2);
    },
    PLAZO,
  );

  // ===========================================================================================
  it(
    'Viernes: 300 pedidos y 400 ingresos en dos ambientes, con cortes de red y problemas',
    async () => {
      const libro = nuevoLibro(VIERNES, 80_000, 5000);
      const admin = await como('admin');
      const delJueves = await consultar<{ documento: string }[]>`
        select c.documento from gesnoc.entrada e join gesnoc.cliente c on c.id = e.cliente_id
        where e.fecha = ${JUEVES} and c.documento like '2%' order by c.documento`;
      const clientesDelJueves = delJueves.map((c) => c.documento).slice(0, 15);

      // --- Preparación de la noche ---
      for (const [ambiente, premio] of [
        ['Salón', 'Botella de ron añejo'],
        ['Terraza', 'Botella de espumante'],
      ] as const) {
        await detalles.elegirPremio(admin, {
          fecha: VIERNES,
          ambienteId: ambienteId(ambiente),
          items: [{ productoId: local.producto.get(premio)!.id, cantidad: 1 }],
        });
      }
      const listas = [
        { nombre: 'Bailarines', responsable: 'Javiera Soto', gratis: true },
        { nombre: 'Despedida de soltera', responsable: 'Carolina Pinto', gratis: false },
      ];
      for (const lista of listas) {
        await detalles.guardarLista(admin, { fecha: VIERNES, numero: null, ...lista });
      }
      const bailarines = [0, 1, 2, 3, 4].map((i) => rut(16_000_000 + i * 11));
      const despedida = [0, 1, 2, 3, 4].map((i) => rut(16_500_000 + i * 11));
      for (const [listaNumero, documentos] of [
        [1, bailarines],
        [2, despedida],
      ] as const) {
        for (const [i, documento] of documentos.entries()) {
          await detalles.invitar(
            admin,
            datosInvitacion.parse({
              fecha: VIERNES,
              documento,
              nombre: `Persona ${i + 1}`,
              apellido: listaNumero === 1 ? 'Bailarina' : 'Invitada',
              listaNumero,
            }),
          );
        }
      }
      const equipo = ['garzon', 'garzon2', 'barra', 'barra2', 'cocina', 'guardia', 'apoyo'];
      for (const clave of equipo) {
        await turnos.declararDisponibilidad(await como(clave), VIERNES, true);
      }
      await asignar(VIERNES, 'garzon', 'garzon', 'Salón');
      await asignar(VIERNES, 'garzon2', 'garzon', 'Terraza');
      await asignar(VIERNES, 'barra', 'barman', 'Salón');
      await asignar(VIERNES, 'barra2', 'barman', 'Terraza');
      await asignar(VIERNES, 'cocina', 'cocinero', null);
      await asignar(VIERNES, 'guardia', 'guardia', null);
      await asignar(VIERNES, 'apoyo', 'guardia', null);
      await noches.abrir(admin, VIERNES, libro.fondo);

      // --- La puerta: 400 ingresos desde dos teléfonos a la vez (EV-03, EV-07) ---
      const azarPuerta = azarCon(41);
      const fila: Visitante[] = [];
      for (const documento of clientesDelJueves) {
        // Vuelven del jueves: se reconocen aunque el guardia digite el RUT con puntos (RN-21).
        fila.push({
          documento,
          tipo: 'rut',
          nombre: 'Vuelve',
          apellido: 'Del jueves',
          forma: formaAlAzar(azarPuerta),
          digitado: conPuntos(documento),
        });
      }
      for (const documento of bailarines) {
        fila.push({ documento, tipo: 'rut', nombre: 'Bai', apellido: 'Larina', forma: 'gratis' });
      }
      for (const documento of despedida) {
        fila.push({ documento, tipo: 'rut', nombre: 'In', apellido: 'Vitada', forma: 'tarjeta' });
      }
      for (let i = 0; i < 6; i++) {
        fila.push({
          documento: `PE${700_000 + i}`,
          tipo: 'extranjero',
          nombre: 'Turista',
          apellido: `Número ${i + 1}`,
          forma: 'tarjeta',
          digitado: `pe-${700_000 + i}`,
        });
      }
      for (let cuerpo = 21_000_000; fila.length < 400; cuerpo += 13) {
        fila.push(visitante(azarPuerta, cuerpo, formaAlAzar(azarPuerta)));
      }
      // Una misma persona llega a los dos teléfonos a la vez: entra una sola vez (RN-21).
      const duplicada = visitante(azarPuerta, 22_999_999, 'efectivo');
      const recorrerPuerta = async (quien: string, personas: Visitante[]) => {
        for (const [i, persona] of personas.entries()) {
          if (quien === 'guardia' && i === 100) {
            const ambas = await Promise.all([
              registrarEntrada(libro, 'guardia', duplicada),
              registrarEntrada(libro, 'apoyo', duplicada),
            ]);
            expect(ambas.map((r) => r.hecho.repetida).sort()).toEqual([false, true]);
          }
          const { busqueda } = await registrarEntrada(libro, quien, persona);
          if (clientesDelJueves.includes(persona.documento)) {
            expect(busqueda.cliente).toMatchObject({ visitas: 1 }); // HU-36: ya vino
          }
          if (bailarines.includes(persona.documento)) {
            expect(busqueda.invitacion).toMatchObject({ lista: 'Bailarines', gratis: true });
          }
        }
      };

      // --- La sala: dos equipos a la vez, uno por ambiente (EV-01) ---
      const agotados = new Set<string>();
      const salon = crearEquipo(
        libro,
        'garzon',
        'barra',
        'Salón',
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        azarCon(7),
        agotados,
      );
      const terraza = crearEquipo(
        libro,
        'garzon2',
        'barra2',
        'Terraza',
        [1, 2, 3],
        azarCon(11),
        agotados,
      );
      await Promise.all([
        recorrerPuerta(
          'guardia',
          fila.filter((_, i) => i % 2 === 0),
        ),
        recorrerPuerta(
          'apoyo',
          fila.filter((_, i) => i % 2 === 1),
        ),
        salon.atender(100),
        terraza.atender(50),
      ]);
      expect(libro.entradas.size).toBe(401); // los 400 de la fila y quien llegó a los dos teléfonos
      // Los bailarines ya entraron: su lista queda como registro de cómo entraron (HU-33 CA2).
      await expect(detalles.quitarLista(admin, VIERNES, 1)).rejects.toThrow(
        '5 personas de esta lista ya entraron',
      );
      await expect(detalles.quitarInvitacion(admin, VIERNES, bailarines[0]!)).rejects.toThrow(
        'Esta persona ya entró esta noche',
      );

      // --- 1:00: la administración actualiza la carta ---
      // Un cliente del Salón pide Schop antes del cambio de precio.
      const gorro = await abrirCuenta(libro, 'garzon', 'Salón', { referencia: 'Gorro negro' });
      await enviarPedido(libro, 'garzon', gorro.numero, [['Schop', 2]]);
      // El Mojito se agotó: ya no se puede pedir ni aparece en la carta (CU-13 5c, HU-06 CA3).
      await catalogo.cambiarProductoActivo(admin, local.producto.get('Mojito')!.id, false);
      agotados.add('Mojito');
      await expect(
        enviarPedido(libro, 'garzon', gorro.numero, [
          ['Mojito', 1],
          ['Schop', 1],
        ]),
      ).rejects.toThrow('Mojito ya no está disponible: quítalo del pedido');
      const carta = await cartaDeMesa(await codigoDe(await mesaDe('Salón', 1)));
      expect(carta!.categorias.flatMap((c) => c.productos.map((p) => p.nombre))).not.toContain(
        'Mojito',
      );
      // El Schop sube de precio: lo ya pedido conserva el suyo (RN-09).
      const schop = local.producto.get('Schop')!;
      await catalogo.editarProducto(admin, schop.id, {
        nombre: 'Schop',
        precio: 3800,
        categoriaId: schop.categoriaId,
        estacionId: null,
      });
      local.precio.set('Schop', 3800);
      await enviarPedido(
        libro,
        'garzon',
        gorro.numero,
        [
          ['Schop', 1],
          ['Papas fritas', 1],
        ],
        3,
      );

      // --- Segunda mitad de la noche ---
      await Promise.all([salon.atender(100), terraza.atender(50)]);
      const precios = await consultar<{ precio: number }[]>`
        select distinct d.precio_unitario as precio from gesnoc.detalle_pedido d
        where d.fecha = ${VIERNES} and d.producto_id = ${schop.id} order by 1`;
      expect(precios.map((p) => p.precio)).toEqual([3500, 3800]);

      // --- Llamados de 10 mesas de los dos ambientes (EV-10) ---
      const llamadoras = [
        ...[1, 2, 3, 4, 5, 6, 7].map((n) => ['Salón', n] as const),
        ...[1, 2, 3].map((n) => ['Terraza', n] as const),
      ];
      for (const [ambiente, numero] of llamadoras) {
        await llamados.llamar(await codigoDe(await mesaDe(ambiente, numero)));
        libro.llamados += 1;
      }
      const delSalon = (await colas.misComandas(await como('garzon'))).llamados;
      const deLaTerraza = (await colas.misComandas(await como('garzon2'))).llamados;
      expect(delSalon).toHaveLength(7);
      expect(deLaTerraza).toHaveLength(3);
      expect(delSalon.every((l) => l.ambiente === 'Salón')).toBe(true);
      expect(deLaTerraza.every((l) => l.ambiente === 'Terraza')).toBe(true);
      libro.llamadosBienAvisados += delSalon.length + deLaTerraza.length;
      await rechazada(libro, async () =>
        llamados.atender(await como('garzon'), deLaTerraza[0]!.numero),
      );
      for (const l of delSalon) await llamados.atender(await como('garzon'), l.numero);
      for (const l of deLaTerraza) await llamados.atender(await como('garzon2'), l.numero);
      // CU-28 2c (RN-28): al regenerar el código, el anterior ya no abre la carta ni llama.
      const mesaT2 = await mesaDe('Terraza', 2);
      const codigoViejo = await codigoDe(mesaT2);
      await regenerarCodigo(admin, mesaT2);
      const codigoNuevo = await codigoDe(mesaT2);
      expect(await cartaDeMesa(codigoViejo)).toBeNull();
      await expect(llamados.llamar(codigoViejo)).rejects.toThrow(llamados.CODIGO_SIN_CARTA);
      expect(await cartaDeMesa(codigoNuevo)).toMatchObject({ mesa: 2, ambiente: 'Terraza' });

      // --- Una pelea en la pista (HU-35, HU-36, EV-11) ---
      const nuevos = [...libro.entradas.keys()].filter((d) => d.startsWith('21'));
      const [peleador, testigo] = nuevos as [string, string];
      const guardia = await como('guardia');
      expect(() =>
        datosReporte.parse({
          tipoDocumento: 'rut',
          documento: peleador,
          tipo: 'expulsion',
          descripcion: ' ',
        }),
      ).toThrow('Describe lo que pasó'); // CU-30 3a
      const reportar = async (
        quien: string,
        documento: string,
        tipo: 'advertencia' | 'expulsion' | 'observacion',
        descripcion: string,
      ) =>
        clientes.reportar(
          await como(quien),
          datosReporte.parse({ tipoDocumento: 'rut', documento, tipo, descripcion }),
        );
      await reportar('guardia', peleador, 'advertencia', 'Empujó a otro cliente en la barra');
      // El otro guardia digita el RUT con puntos: es el mismo cliente.
      await reportar(
        'apoyo',
        conPuntos(peleador),
        'expulsion',
        'Comenzó a buscar pelea en la pista',
      );
      await reportar('guardia', testigo, 'observacion', 'Ayudó a separar la pelea');
      await expect(
        reportar('guardia', rut(30_000_001), 'observacion', 'Nunca vino'),
      ).rejects.toThrow('Ese documento no tiene registro');
      // HU-36 CA1: del más reciente al más antiguo; el otro guardia lo ve igual (CU-30 5a).
      const historial = await clientes.historial(await como('apoyo'), peleador);
      expect(historial.reportes.map((r) => r.tipo)).toEqual(['expulsion', 'advertencia']);
      expect(historial.visitas.map((v) => v.fecha)).toEqual([VIERNES]);
      // RN-25 y RNF-11: ni el garzón, ni la barra, ni la cocina ven los datos de los clientes.
      for (const clave of ['garzon', 'barra', 'cocina']) {
        await rechazada(libro, async () => clientes.historial(await como(clave), peleador));
        await rechazada(libro, async () => puerta.buscar(await como(clave), peleador));
        await rechazada(libro, async () => clientes.buscarClientes(await como(clave), 'Muñoz'));
        await rechazada(libro, async () => puerta.ingresosDeLaNoche(await como(clave)));
      }
      // La administración corrige un nombre mal escrito; el documento no cambia.
      await clientes.corregirFicha(
        admin,
        datosFicha.parse({
          tipoDocumento: 'rut',
          documento: testigo,
          nombre: 'Ignacio',
          apellido: 'Bravo',
        }),
      );
      expect((await clientes.historial(guardia, testigo)).cliente).toEqual({
        nombre: 'Ignacio',
        apellido: 'Bravo',
      });

      // --- Anulaciones (HU-22, RN-15) ---
      // Con un pago, ya no se anula nada.
      await pagar(libro, 'garzon', gorro.numero, 'efectivo', 1000);
      const conPago = (await cuentas.detalleCuenta(await como('garzon'), gorro.numero))!;
      await expect(
        pedidos.anular(await como('garzon'), {
          cuenta: gorro.numero,
          pedido: conPago.pedidos[0]!.numero,
          linea: conPago.pedidos[0]!.lineas[0]!.linea,
        }),
      ).rejects.toThrow('La cuenta ya tiene pagos: no se pueden anular ítems');
      // Una comanda anulada completa no se marca lista.
      const pareja = await abrirCuenta(libro, 'garzon2', 'Terraza', {
        referencia: 'Pareja del rincón',
      });
      const soloUno = await enviarPedido(libro, 'garzon2', pareja.numero, [['Pisco sour', 1]]);
      await anularLinea(libro, 'garzon2', pareja.numero, soloUno.numero, 'Pisco sour');
      await expect(
        colas.marcarLista(await como('barra2'), soloUno.numero, estacionId('Barra Terraza')),
      ).rejects.toThrow('La comanda se anuló completa: no hay nada que preparar');

      // --- Cobros a la vez en una misma cuenta (CU-18 4b, RN-18) ---
      const grupo = await abrirCuenta(libro, 'garzon2', 'Terraza', {
        referencia: 'Grupo de amigos',
      });
      await enviarPedido(libro, 'garzon2', grupo.numero, [
        ['Botella de vodka', 1],
        ['Bebida', 4],
      ]);
      const total = libro.consumo.get(grupo.numero)!;
      const intentos = await Promise.allSettled([
        pagar(libro, 'garzon2', grupo.numero, 'tarjeta', total),
        pagar(libro, 'admin', grupo.numero, 'transferencia', total),
      ]);
      expect(intentos.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const perdedor = intentos.find((r): r is PromiseRejectedResult => r.status === 'rejected')!;
      expect(String(perdedor.reason)).toMatch('La cuenta ya está cerrada');
      // RNF-03: el cobro con corte de red se reintenta con la misma clave y no se cobra dos veces.
      const cumpleanero = await abrirCuenta(libro, 'garzon2', 'Terraza', {
        referencia: 'Cumpleañero',
      });
      await enviarPedido(libro, 'garzon2', cumpleanero.numero, [['Schop', 6]]);
      await cobrarCuenta(libro, 'garzon2', cumpleanero.numero, 'saldo', azarCon(23), true);

      // --- El sorteo de los dos ambientes (HU-37, RN-23) ---
      const ganaSalon = await sorteo.sortear(await como('guardia'), ambienteId('Salón'));
      const ganaTerraza = await sorteo.sortear(await como('apoyo'), ambienteId('Terraza'));
      expect(ganaTerraza.ticket).not.toBe(ganaSalon.ticket); // un ticket no gana dos veces
      expect(await sorteo.sortear(await como('apoyo'), ambienteId('Salón'))).toEqual({
        ...ganaSalon,
        repetido: true,
      });

      // --- El cierre con pendientes (HU-12, CU-11 2a) ---
      await expect(caja.cerrarNoche(admin, VIERNES)).rejects.toThrow(
        /^No se puede cerrar: queda \d+ cuentas? abiertas?, \d+ pagos? en efectivo sin confirmar y la caja sin contar$/,
      );
      // HU-27: el cliente del gorro se fue sin pagar todo; la administración cierra con saldo.
      const { cuentas: conSaldo } = await caja.pantallaSaldos(admin);
      const seFue = conSaldo.find((c) => c.numero === gorro.numero)!;
      expect(seFue.saldo).toBe(libro.consumo.get(gorro.numero)! - 1000);
      await rechazada(libro, async () => caja.cerrarConSaldo(await como('garzon'), gorro.numero));
      expect(await caja.cerrarConSaldo(admin, gorro.numero)).toEqual({ saldo: seFue.saldo });
      libro.cerradoConSaldo += seFue.saldo;
      const [cerradaPor] = await consultar<{ cerrada_por: number }[]>`
        select cerrada_por from gesnoc.cuenta where fecha = ${VIERNES} and numero = ${gorro.numero}`;
      expect(cerradaPor!.cerrada_por).toBe(personaId('admin')); // HU-27 CA2
      // Lo que falta se prepara y se entrega, y las demás cuentas se cobran.
      await rondaDeEstaciones(
        libro,
        [
          ['barra', 'barra'],
          ['barra2', 'barra'],
          ['cocina', 'cocina'],
        ],
        ['garzon', 'garzon2'],
      );
      const azarCierre = azarCon(5);
      for (const { numero, ambiente } of (await caja.pantallaSaldos(admin)).cuentas) {
        const quien = ambiente === 'Salón' ? 'garzon' : 'garzon2';
        const { saldo } = (await cuentas.detalleCuenta(await como(quien), numero))!;
        if (saldo === 0) await cuentas.cerrarSinConsumo(await como(quien), numero);
        else await cobrarCuenta(libro, quien, numero, 'saldo', azarCierre);
      }
      // HU-26: el efectivo que llega mientras la administración mira queda pendiente.
      const { garzones } = await caja.pantallaEfectivo(admin);
      const vistos = garzones.flatMap((g) =>
        g.pagos.map(({ cuenta, numero }) => ({ cuenta, numero })),
      );
      const ultima = await abrirCuenta(libro, 'garzon', 'Salón', { referencia: 'Último trago' });
      await enviarPedido(libro, 'garzon', ultima.numero, [['Schop', 1]]);
      await pagar(libro, 'garzon', ultima.numero, 'efectivo', 3800, 200);
      await caja.confirmarEfectivo(admin, vistos);
      expect((await caja.pantallaArqueo(admin)).sinConfirmar).toBe(1);
      expect((await pagos.miEfectivo(await como('garzon'))).total).toBe(4000);
      await confirmarTodoElEfectivo(admin);
      await rondaDeEstaciones(libro, [['barra', 'barra']], ['garzon']);

      // HU-28: el conteo con una diferencia incluida a propósito exige la nota (RN-20).
      const esperado = esperadoSegunLibro(libro);
      expect((await caja.pantallaArqueo(admin)).esperado!.total).toBe(esperado);
      await expect(caja.contar(admin, esperado - 2000, null)).rejects.toThrow(
        'El contado no cuadra con el esperado (faltan $2.000): explica la diferencia en la nota',
      );
      const nota = 'Faltan $2.000: un vuelto mal entregado en la barra';
      expect(await caja.contar(admin, esperado - 2000, nota)).toEqual({
        esperado,
        contado: esperado - 2000,
        diferencia: -2000,
      });
      // Una entrada en efectivo después del conteo cambia el esperado: hay que volver a contar.
      await registrarEntrada(libro, 'guardia', visitante(azarPuerta, 23_456_789, 'efectivo'));
      await expect(caja.cerrarNoche(admin, VIERNES)).rejects.toThrow(
        'No se puede cerrar: queda la caja sin contar',
      );
      const recontado = esperadoSegunLibro(libro) - 2000;
      await caja.contar(admin, recontado, nota);

      // Rodrigo vino hace 364 días: todavía no se anonimiza.
      expect(await caja.cerrarNoche(admin, VIERNES)).toEqual({ anonimizados: 0 });
      const resumen = await comprobarNoche(libro);
      expect(resumen.pedidos).toBeGreaterThanOrEqual(300); // EV-01
      expect(resumen.ingresos).toBeGreaterThanOrEqual(400); // EV-03 y EV-07
      expect(libro.cortes).toBeGreaterThanOrEqual(20); // RNF-03
      expect(resumen.fueraDeTurno).toBeGreaterThanOrEqual(30); // OE4: RN-14, RN-18 y RN-25
      expect(resumen.contado).toBe(recontado); // OE2: la diferencia quedó con su nota
      const [arqueo] = await consultar<{ nota: string }[]>`
        select nota from gesnoc.arqueo where fecha = ${VIERNES}`;
      expect(arqueo!.nota).toBe(nota);
      resumenes.push(resumen);

      // Los indicadores y la bitácora cuentan la misma noche.
      const { detalle: panel } = await indicadoresDeLaNoche(admin, VIERNES);
      expect(suma(panel!.porGarzon.map((g) => g.pedidos))).toBe(libro.pedidos.size);
      expect(suma(panel!.porGarzon.map((g) => g.vendido))).toBe(suma([...libro.consumo.values()]));
      const { eventos } = await bitacora(admin, VIERNES);
      expect(eventos.filter((e) => e.texto.startsWith('Envió el pedido'))).toHaveLength(
        libro.pedidos.size,
      );
      expect(eventos.filter((e) => e.texto.startsWith('Registró la entrada'))).toHaveLength(
        libro.entradas.size,
      );
      await comprobarNocheCerrada(libro, ultima.numero, codigoNuevo);
    },
    PLAZO,
  );

  // ===========================================================================================
  it(
    'Sábado: 12 personas de turno, imprevistos, una carrera con el cierre y la anonimización',
    async () => {
      const azar = azarCon(19);
      const libro = nuevoLibro(SABADO, 60_000, 7000);
      const admin = await como('admin');

      // Rodrigo cumplió el viernes 364 días sin venir: sus datos siguen ahí.
      const [antes] = await consultar<{ nombre: string }[]>`
        select nombre from gesnoc.cliente where documento = ${rut(11_111_112)}`;
      expect(antes!.nombre).toBe('Rodrigo');

      // --- Un ambiente nuevo, sin barra todavía (HU-04, HU-05) ---
      await ambientes.crear(admin, { nombre: 'Rooftop', planoAncho: 600, planoAlto: 300 });
      await leerLocal();
      const mesasRooftop = await guardarPlano(admin, {
        ambienteId: ambienteId('Rooftop'),
        mesas: [1, 2].map((numero) => ({
          numero,
          forma: 'redonda' as const,
          posX: 40 + (numero - 1) * 200,
          posY: 60,
          ancho: 100,
          alto: 100,
          rotacion: 0,
          sillas: null,
        })),
        retiradas: [],
      });
      expect(mesasRooftop.map((m) => m.numero)).toEqual([1, 2]);
      // HU-06: una botella de la casa que siempre se prepara en la barra del Salón.
      await catalogo.crearProducto(admin, {
        nombre: 'Champaña de la casa',
        precio: 24_000,
        categoriaId: local.producto.get('Botella de vodka')!.categoriaId,
        estacionId: estacionId('Barra Salón'),
      });
      await catalogo.cambiarProductoActivo(admin, local.producto.get('Mojito')!.id, true);
      await leerLocal();
      await detalles.elegirPremio(admin, {
        fecha: SABADO,
        ambienteId: ambienteId('Salón'),
        items: [{ productoId: local.producto.get('Botella de vodka')!.id, cantidad: 2 }],
      });
      await detalles.elegirPremio(admin, {
        fecha: SABADO,
        ambienteId: ambienteId('Terraza'),
        items: [{ productoId: local.producto.get('Champaña de la casa')!.id, cantidad: 1 }],
      });

      // --- Personal (HU-01, HU-03): cinco refuerzos y un bloqueo por intentos fallidos ---
      for (let i = 1; i <= 5; i++) {
        await personal.crear(
          admin,
          datosPersonaNueva.parse({
            nombre: `Refuerzo ${i}`,
            correo: ` Refuerzo${i}@GesNoc.TEST `,
            clave: CLAVE,
          }),
        );
      }
      // HU-03 CA1: el correo se guarda en minúsculas y no se repite.
      await expect(
        personal.crear(
          admin,
          datosPersonaNueva.parse({
            nombre: 'Copia',
            correo: 'refuerzo1@gesnoc.test',
            clave: CLAVE,
          }),
        ),
      ).rejects.toThrow('Ya existe una cuenta con ese correo');
      await leerLocal();
      const refuerzos = [1, 2, 3, 4, 5].map((i) => `refuerzo${i}`);
      for (const clave of refuerzos) await ingresar(clave);
      // RF-01: cinco intentos fallidos seguidos bloquean la cuenta 15 minutos.
      for (let i = 0; i < 4; i++) {
        await expect(iniciarSesion(correoDe('apoyo'), 'no-es-la-clave')).rejects.toThrow(
          'Correo o contraseña incorrectos',
        );
      }
      await expect(iniciarSesion(correoDe('apoyo'), 'no-es-la-clave')).rejects.toThrow(
        'Cuenta bloqueada por 15 minutos tras varios intentos fallidos',
      );
      await rechazada(libro, () => iniciarSesion(correoDe('apoyo'), CLAVE), 'Cuenta bloqueada');
      await consultar`
        update gesnoc.usuario set bloqueado_hasta = now() - interval '1 second'
        where id = ${personaId('apoyo')}`; // pasaron los 15 minutos
      await ingresar('apoyo');

      // --- Asignación de 12 personas (EV-04) ---
      const dotacion: [string, RolTurno, string | null][] = [
        ['garzon', 'garzon', 'Salón'],
        ['refuerzo1', 'garzon', 'Salón'],
        ['refuerzo2', 'garzon', 'Terraza'],
        ['garzon2', 'garzon', 'Rooftop'],
        ['barra', 'barman', 'Salón'],
        ['barra2', 'barman', 'Terraza'],
        ['refuerzo3', 'barman', 'Rooftop'],
        ['cocina', 'cocinero', null],
        ['refuerzo4', 'cocinero', null],
        ['guardia', 'guardia', null],
        ['apoyo', 'guardia', null],
        ['refuerzo5', 'guardia', null],
      ];
      for (const [clave] of [...dotacion, ['sinturno']]) {
        await turnos.declararDisponibilidad(await como(clave!), SABADO, true);
      }
      // CU-09 4a: Paula estaba en la Terraza y pasa al Rooftop; sigue con un solo turno (RN-04).
      await asignar(SABADO, 'garzon2', 'garzon', 'Terraza');
      for (const [clave, rol, ambiente] of dotacion) await asignar(SABADO, clave, rol, ambiente);
      const turnosDePaula = await consultar<{ ambiente_id: number }[]>`
        select ambiente_id from gesnoc.asignacion
        where fecha = ${SABADO} and usuario_id = ${personaId('garzon2')}`;
      expect(turnosDePaula).toEqual([{ ambiente_id: ambienteId('Rooftop') }]);
      // CU-09 3b: a Lucía se le asigna un turno y después se le quita: deja de verlo.
      await asignar(SABADO, 'sinturno', 'guardia', null);
      await turnos.quitar(admin, SABADO, personaId('sinturno'));
      const deLucia = await turnos.misTurnos(await como('sinturno'));
      expect(deLucia.find((t) => t.fecha === SABADO)).toMatchObject({ rol: null });
      // OE4: los 12 turnos respetan la disponibilidad declarada y la regla del ambiente.
      const asignados = await consultar<
        { rol: RolTurno; ambiente_id: number | null; postulo: boolean }[]
      >`
        select a.rol, a.ambiente_id,
               exists (select 1 from gesnoc.disponibilidad d
                       where d.fecha = a.fecha and d.usuario_id = a.usuario_id) as postulo
        from gesnoc.asignacion a where a.fecha = ${SABADO}`;
      expect(asignados).toHaveLength(12);
      for (const turno of asignados) {
        expect(turno.postulo).toBe(true);
        expect(turno.ambiente_id === null).toBe(
          turno.rol === 'cocinero' || turno.rol === 'guardia',
        );
      }

      await noches.abrir(admin, SABADO, libro.fondo);

      // EV-04: cada una de las 12 cuentas entra y llega solo a las funciones de su rol (RF-04).
      const pantallaDe: Record<RolTurno, string> = {
        garzon: '/garzon',
        barman: '/barra',
        cocinero: '/cocina',
        guardia: '/guardia',
      };
      for (const [clave, rol] of dotacion) {
        await ingresar(clave);
        const actor = await como(clave);
        expect(inicioDe(actor)).toBe(pantallaDe[rol]);
        await rechazada(libro, () => caja.pantallaArqueo(actor));
        if (rol === 'garzon') await rechazada(libro, () => colas.cola(actor, 'cocina'));
        if (rol === 'barman') await rechazada(libro, () => puerta.ingresosDeLaNoche(actor));
        if (rol === 'cocinero') await rechazada(libro, () => cuentas.mapa(actor));
        if (rol === 'guardia') await rechazada(libro, () => colas.cola(actor, 'barra'));
      }
      await rechazada(libro, async () =>
        puerta.registrar(
          await como('sinturno'),
          datosEntrada.parse({
            tipoDocumento: 'rut',
            documento: rut(24_000_001),
            nombre: 'Sin',
            apellido: 'Turno',
            forma: 'efectivo',
            monto: libro.precioEntrada,
          }),
        ),
      );

      // --- La puerta: el expulsado del viernes vuelve y aparece su historial (HU-36 CA2) ---
      const [expulsado] = await consultar<{ documento: string }[]>`
        select c.documento from gesnoc.reporte r join gesnoc.cliente c on c.id = r.cliente_id
        where r.tipo = 'expulsion'`;
      const busqueda = await puerta.buscar(await como('refuerzo5'), expulsado!.documento);
      expect(busqueda.cliente!.reportes).toMatchObject({ total: 2, expulsado: true });
      // El guardia no lo deja pasar: no se registra su entrada. Entran otras 60 personas.
      const porTres = [[], [], []] as Visitante[][];
      for (let i = 0; i < 60; i++) {
        porTres[i % 3]!.push(visitante(azar, 25_000_000 + i * 17, formaAlAzar(azar)));
      }
      await Promise.all(
        ['guardia', 'apoyo', 'refuerzo5'].map(async (quien, i) => {
          for (const persona of porTres[i]!) await registrarEntrada(libro, quien, persona);
        }),
      );

      // --- La sala ---
      // CU-13 5e: el Rooftop todavía no tiene barra: el pedido no se registra, ni la comida.
      const rooftop = (await abrirCuenta(libro, 'garzon2', 'Rooftop', { mesa: 1 })).numero;
      await expect(
        enviarPedido(
          libro,
          'garzon2',
          rooftop,
          [
            ['Piscola', 2],
            ['Papas fritas', 1],
          ],
          2,
        ),
      ).rejects.toThrow(
        'Este ambiente no tiene barra configurada: Piscola no tiene dónde prepararse',
      );
      // Su barman no tiene cola: no hay barra que atender.
      expect((await colas.cola(await como('refuerzo3'), 'barra')).estacion).toBeNull();
      await enviarPedido(libro, 'garzon2', rooftop, [['Papas fritas', 1]], 2);
      await ambientes.crearEstacion(admin, {
        nombre: 'Barra Rooftop',
        tipo: 'barra',
        ambienteId: ambienteId('Rooftop'),
      });
      await expect(
        ambientes.crearEstacion(admin, {
          nombre: 'Segunda barra',
          tipo: 'barra',
          ambienteId: ambienteId('Rooftop'),
        }),
      ).rejects.toThrow('Este ambiente ya tiene una barra'); // RN-27
      await leerLocal();
      await enviarPedido(libro, 'garzon2', rooftop, [['Piscola', 2]]);
      // La botella de la casa va a la barra del Salón aunque la pidan en la Terraza (RN-10).
      const terraza = (await abrirCuenta(libro, 'refuerzo2', 'Terraza', { mesa: 1 })).numero;
      const champana = await enviarPedido(libro, 'refuerzo2', terraza, [
        ['Champaña de la casa', 1],
      ]);
      expect(champana.estaciones).toEqual(['Barra Salón']);
      // Dos garzones en el Salón: cada uno abre sus mesas.
      const salon: number[] = [];
      for (const [quien, mesa] of [
        ['garzon', 1],
        ['garzon', 3],
        ['refuerzo1', 5],
        ['refuerzo1', 11],
      ] as const) {
        salon.push((await abrirCuenta(libro, quien, 'Salón', { mesa })).numero);
      }
      for (let i = 0; i < 20; i++) {
        const lineas = pedidoAlAzar(azar, () => true);
        const quien = i % 4 < 2 ? 'garzon' : 'refuerzo1';
        await enviarPedido(libro, quien, salon[i % 4]!, lineas, llevaComida(lineas) ? 2 : null);
      }

      // Matías deja el local a mitad de la noche: su cuenta se desactiva y su sesión deja de
      // funcionar de inmediato (HU-03 CA2, RNF-01). La administración atiende la barra de la Terraza.
      await personal.cambiarActivo(admin, personaId('barra2'), false);
      expect(await actorDeToken(tokens.get('barra2')!)).toBeNull();
      await rechazada(
        libro,
        () => iniciarSesion(correoDe('barra2'), CLAVE),
        'Correo o contraseña incorrectos',
      );
      // HU-20 CA1: en el Salón hay dos garzones, y cada uno recibe solo los avisos de sus pedidos.
      await rondaDeEstaciones(
        libro,
        [
          ['barra', 'barra'],
          ['admin', 'barra', 'Barra Terraza'],
          ['refuerzo3', 'barra'],
          ['cocina', 'cocina'],
          ['refuerzo4', 'cocina'],
        ],
        ['garzon', 'refuerzo1', 'refuerzo2', 'garzon2'],
      );

      // HU-02: el guardia cierra sesión y su cookie ya no sirve; la sesión de la cocina vence.
      await cerrarSesion(tokens.get('guardia')!);
      expect(await actorDeToken(tokens.get('guardia')!)).toBeNull();
      await ingresar('guardia');
      await consultar`
        update gesnoc.sesion set expira_en = now() - interval '1 second'
        where usuario_id = ${personaId('cocina')}`; // pasaron las 12 horas
      expect(await actorDeToken(tokens.get('cocina')!)).toBeNull();
      await ingresar('cocina');
      expect(inicioDe(await como('cocina'))).toBe('/cocina');

      // HU-05: se retira la mesa 12 del Salón y la 11 pasa a ser la 21, con su cuenta abierta (CA3).
      const mesa12 = await mesaDe('Salón', 12);
      const codigo12 = await codigoDe(mesa12);
      await expect(
        guardarPlano(admin, {
          ambienteId: ambienteId('Salón'),
          mesas: [],
          retiradas: [await mesaDe('Salón', 3)],
        }),
      ).rejects.toThrow('La mesa 3 tiene una cuenta abierta: no se puede retirar');
      const [mesa11] = await consultar<
        { id: number; pos_x: number; pos_y: number; ancho: number; alto: number }[]
      >`
        select id, pos_x, pos_y, ancho, alto from gesnoc.mesa where id = ${await mesaDe('Salón', 11)}`;
      await guardarPlano(admin, {
        ambienteId: ambienteId('Salón'),
        mesas: [
          {
            id: mesa11!.id,
            numero: 21,
            forma: 'rectangular',
            posX: mesa11!.pos_x,
            posY: mesa11!.pos_y,
            ancho: mesa11!.ancho,
            alto: mesa11!.alto,
            rotacion: 0,
            sillas: null,
          },
        ],
        retiradas: [mesa12],
      });
      expect(await cartaDeMesa(codigo12)).toBeNull(); // CU-28 2c: la mesa se retiró
      await expect(llamados.llamar(codigo12)).rejects.toThrow(llamados.CODIGO_SIN_CARTA);
      const { mesas } = await cuentas.mapa(await como('refuerzo1'));
      expect(mesas.map((m) => m.numero)).not.toContain(12);
      expect(mesas.find((m) => m.numero === 21)!.cuenta).toBe(salon[3]);
      // HU-40 CA1: el llamado de una mesa del Salón llega a los dos garzones del Salón.
      await llamados.llamar(await codigoDe(await mesaDe('Salón', 21)));
      libro.llamados += 1;
      const aDiego = (await colas.misComandas(await como('garzon'))).llamados;
      const aRefuerzo = (await colas.misComandas(await como('refuerzo1'))).llamados;
      const aTerraza = (await colas.misComandas(await como('refuerzo2'))).llamados;
      expect(aDiego.map((l) => l.mesa)).toEqual([21]);
      expect(aRefuerzo).toEqual(aDiego);
      expect(aTerraza).toEqual([]);
      libro.llamadosBienAvisados += 1;
      await llamados.atender(await como('refuerzo1'), aDiego[0]!.numero);

      // RN-14: la barra del Salón no marca la de la Terraza.
      const otraTerraza = await enviarPedido(libro, 'refuerzo2', terraza, [['Piscola', 1]]);
      await rechazada(libro, async () =>
        colas.marcarLista(await como('barra'), otraTerraza.numero, estacionId('Barra Terraza')),
      );
      await rondaDeEstaciones(
        libro,
        [
          ['admin', 'barra', 'Barra Terraza'],
          ['barra', 'barra'],
          ['cocina', 'cocina'],
        ],
        ['garzon', 'refuerzo1', 'refuerzo2', 'garzon2'],
      );

      // --- Cobro de todo y sorteo ---
      // RN-14: cualquier garzón del ambiente cobra la cuenta, aunque la haya abierto otro.
      const formas = ['saldo', 2, 'items', 3] as const;
      for (const [i, cuenta] of salon.entries()) {
        await cobrarCuenta(libro, i === 0 ? 'refuerzo1' : 'garzon', cuenta, formas[i]!, azar);
      }
      await cobrarCuenta(libro, 'garzon2', rooftop, 'libre', azar);
      await cobrarCuenta(libro, 'refuerzo2', terraza, 2, azar, true);
      const ganaSalon = await sorteo.sortear(await como('refuerzo5'), ambienteId('Salón'));
      const ganaTerraza = await sorteo.sortear(await como('guardia'), ambienteId('Terraza'));
      expect(ganaSalon.premio).toBe('2 × Botella de vodka');
      expect(ganaTerraza.premio).toBe('1 × Champaña de la casa');
      await expect(sorteo.sortear(await como('guardia'), ambienteId('Rooftop'))).rejects.toThrow(
        'Este ambiente no tiene premio',
      );

      // --- Caja: sobra plata y se explica; después, una carrera con el cierre (RN-26) ---
      await confirmarTodoElEfectivo(admin);
      const esperado = esperadoSegunLibro(libro);
      await caja.contar(admin, esperado + 1000, 'Sobran $1.000: una propina que no se anotó');
      // La petición del garzón salió justo cuando la administración tocó «Cerrar la noche».
      const garzon = await como('garzon');
      const mesa7 = await mesaDe('Salón', 7);
      const [cierre, apertura] = await Promise.allSettled([
        caja.cerrarNoche(admin, SABADO),
        cuentas.abrir(garzon, { mesaId: mesa7 }),
      ]);
      // Las dos no pueden ganar: o la cuenta entró antes y el cierre la ve, o el cierre fue primero.
      expect([cierre.status, apertura.status].filter((s) => s === 'fulfilled')).toHaveLength(1);
      let anonimizados: number;
      if (apertura.status === 'fulfilled') {
        expect(String((cierre as PromiseRejectedResult).reason)).toMatch('1 cuenta abierta');
        await cuentas.cerrarSinConsumo(await como('garzon'), apertura.value.numero);
        ({ anonimizados } = await caja.cerrarNoche(admin, SABADO));
      } else {
        expect(String(apertura.reason)).toMatch('No hay una noche abierta');
        ({ anonimizados } = (cierre as PromiseFulfilledResult<{ anonimizados: number }>).value);
      }

      // RN-25 y RN-30: Rodrigo cumplió 12 meses sin venir y se anonimizó, con su reporte; Valentina
      // no. Las listas e invitaciones de hace un año también se borraron.
      expect(anonimizados).toBe(1);
      const [rodrigo] = await consultar<{ documento: string; nombre: string; apellido: string }[]>`
        select documento, nombre, apellido from gesnoc.cliente where nombre = 'Anónimo'`;
      expect(rodrigo).toMatchObject({ nombre: 'Anónimo', apellido: 'Anónimo' });
      expect(rodrigo!.documento).toMatch(/^ANON\d+$/);
      const suyos = await consultar<{ descripcion: string }[]>`
        select r.descripcion from gesnoc.reporte r join gesnoc.cliente c on c.id = r.cliente_id
        where c.documento = ${rodrigo!.documento}`;
      expect(suyos).toEqual([{ descripcion: 'Anonimizado' }]);
      const [valentina] = await consultar<{ nombre: string }[]>`
        select nombre from gesnoc.cliente where documento = ${rut(12_222_223)}`;
      expect(valentina!.nombre).toBe('Valentina');
      expect(
        await consultar`select 1 from gesnoc.invitacion where fecha = ${HACE_UN_ANO}`,
      ).toHaveLength(0);
      expect(await consultar`select 1 from gesnoc.lista where fecha = ${HACE_UN_ANO}`).toHaveLength(
        0,
      );
      // Si vuelve, la puerta no lo reconoce: es una persona nueva.
      expect(
        await consultar`select 1 from gesnoc.cliente where documento = ${rut(11_111_112)}`,
      ).toHaveLength(0);

      const resumen = await comprobarNoche(libro);
      expect(resumen.contado).toBe(esperado + 1000);
      resumenes.push(resumen);
      await comprobarNocheCerrada(libro, salon[0]!, await codigoDe(await mesaDe('Salón', 1)));

      // Las tres noches, en una tabla para el informe.
      console.table(resumenes);
    },
    PLAZO,
  );
});
