// RNF-03: la base garantiza por sí misma las reglas que pueden declararse en ella, aunque un programa
// se equivoque. Cada prueba escribe directo con el rol de la aplicación (gesnoc_app), sin pasar por
// los servicios, y espera que PostgreSQL rechace la fila con su código: 23505 (único), 23514
// (verificación), 23503 (referencia) o 23502 (obligatorio).
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { conBaseVacia } from './apoyo';
import { fecha, prepararNoche, type Local } from './noche-abierta';

const app = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
afterAll(() => app.end());

conBaseVacia();

/** El código con que la base rechazó la sentencia, o «aceptada». */
async function codigo(sentencia: Promise<unknown>) {
  try {
    await sentencia;
    return 'aceptada';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

let local: Local;
let garzon: number;
let mesa4: number;

beforeEach(async () => {
  local = await prepararNoche();
  garzon = local.persona('garzon').id;
  mesa4 = local.mesa(local.salon, 4);
});

const cuentaEnMesa = (numero: number, mesaId = mesa4) =>
  app`insert into gesnoc.cuenta (fecha, numero, mesa_id, abierta_por)
      values (${fecha}, ${numero}, ${mesaId}, ${garzon})`;

const pedido = (numero: number, cuenta: number, clave = randomUUID(), dia = fecha) =>
  app`insert into gesnoc.pedido (fecha, numero, cuenta_numero, tomado_por, clave_envio)
      values (${dia}, ${numero}, ${cuenta}, ${garzon}, ${clave})`;

const pago = (
  numero: number,
  datos: { medio?: string; monto?: number; propina?: number; clave?: string } = {},
) =>
  app`insert into gesnoc.pago
        (fecha, cuenta_numero, numero, medio, monto, propina, registrado_por, clave_envio)
      values (${fecha}, 1, ${numero}, ${datos.medio ?? 'tarjeta'}, ${datos.monto ?? 1000},
              ${datos.propina ?? 0}, ${garzon}, ${datos.clave ?? randomUUID()})`;

async function cliente(documento: string) {
  const [fila] = await app<{ id: number }[]>`
    insert into gesnoc.cliente (documento, nombre, apellido)
    values (${documento}, 'Camila', 'Rojas') returning id`;
  return fila!.id;
}

const entrada = (clienteId: number, monto: number, medio: string | null, ticket: number | null) =>
  app`insert into gesnoc.entrada (fecha, cliente_id, monto, medio_pago, ticket, registrada_por)
      values (${fecha}, ${clienteId}, ${monto}, ${medio}, ${ticket}, ${garzon})`;

describe('la base rechaza lo que viola una regla, aunque el servidor se equivoque (RNF-03)', () => {
  it('RN-06: una mesa no tiene dos cuentas abiertas', async () => {
    await cuentaEnMesa(1);
    expect(await codigo(cuentaEnMesa(2))).toBe('23505');
  });

  it('RN-07: la cuenta está en una mesa o de pie con una referencia, nunca ambas ni ninguna', async () => {
    const cuenta = (
      numero: number,
      mesa: number | null,
      ambiente: number | null,
      ref: string | null,
    ) =>
      app`insert into gesnoc.cuenta (fecha, numero, mesa_id, ambiente_id, referencia, abierta_por)
          values (${fecha}, ${numero}, ${mesa}, ${ambiente}, ${ref}, ${garzon})`;
    expect(await codigo(cuenta(1, mesa4, local.salon, 'Polera roja'))).toBe('23514');
    expect(await codigo(cuenta(2, null, null, null))).toBe('23514');
    expect(await codigo(cuenta(3, null, local.salon, null))).toBe('23514');
    expect(await codigo(cuenta(4, null, local.salon, 'Polera roja'))).toBe('aceptada');
  });

  it('RN-08: un pedido pertenece a la misma noche que su cuenta', async () => {
    await cuentaEnMesa(1);
    expect(await codigo(pedido(1, 1, randomUUID(), '2026-11-08'))).toBe('23503');
    expect(await codigo(pedido(1, 1))).toBe('aceptada');
  });

  it('RN-13: una clave de envío no se registra dos veces, ni en pedidos ni en pagos', async () => {
    await cuentaEnMesa(1);
    const clave = randomUUID();
    await pedido(1, 1, clave);
    expect(await codigo(pedido(2, 1, clave))).toBe('23505');
    await pago(1, { clave });
    expect(await codigo(pago(2, { clave }))).toBe('23505');
  });

  it('RN-16: los medios de pago son un dominio cerrado', async () => {
    await cuentaEnMesa(1);
    expect(await codigo(pago(1, { medio: 'cheque' }))).toBe('23514');
    const id = await cliente('12345678-5');
    expect(await codigo(entrada(id, 5000, 'transferencia', 1))).toBe('23514');
    expect(await codigo(entrada(id, 5000, 'pendiente', 1))).toBe('aceptada');
  });

  it('RN-17: solo el efectivo se confirma, y la confirmación lleva quién y cuándo', async () => {
    await cuentaEnMesa(1);
    await pago(1, { medio: 'tarjeta' });
    await pago(2, { medio: 'efectivo' });
    const confirmar = (numero: number, por: number | null) =>
      app`update gesnoc.pago set confirmado_en = now(), confirmado_por = ${por}
          where fecha = ${fecha} and cuenta_numero = 1 and numero = ${numero}`;
    expect(await codigo(confirmar(1, garzon))).toBe('23514');
    expect(await codigo(confirmar(2, null))).toBe('23514');
    expect(await codigo(confirmar(2, garzon))).toBe('aceptada');
  });

  it('RN-24: el dinero va en pesos enteros; los pagos son mayores que cero', async () => {
    await cuentaEnMesa(1);
    expect(await codigo(pago(1, { monto: 0 }))).toBe('23514');
    expect(await codigo(pago(1, { monto: 1000, propina: -1 }))).toBe('23514');
    const contar = (contado: number) =>
      app`update gesnoc.arqueo set efectivo_contado = ${contado}, contado_por = ${garzon}
          where fecha = ${fecha}`;
    expect(await codigo(contar(-1))).toBe('23514');
    expect(await codigo(contar(0))).toBe('aceptada');
  });

  it('RN-15: una anulación registra a la vez quién y cuándo', async () => {
    await cuentaEnMesa(1);
    await pedido(1, 1);
    const cocina = await app<
      { id: number }[]
    >`select id from gesnoc.estacion where tipo = 'cocina'`;
    await app`insert into gesnoc.comanda (fecha, pedido_numero, estacion_id)
              values (${fecha}, 1, ${cocina[0]!.id})`;
    await app`insert into gesnoc.detalle_pedido
                (fecha, pedido_numero, linea, producto_id, estacion_id, cantidad, precio_unitario)
              values (${fecha}, 1, 1, ${local.producto('Papas fritas')}, ${cocina[0]!.id}, 1, 6500)`;
    expect(
      await codigo(app`update gesnoc.detalle_pedido set anulado_en = now() where fecha = ${fecha}`),
    ).toBe('23514');
    // RN-09: el precio copiado en la línea no se cambia.
    expect(
      await codigo(
        app`update gesnoc.detalle_pedido set precio_unitario = 1 where fecha = ${fecha}`,
      ),
    ).toBe('42501');
  });

  it('RN-21 y RN-22: una entrada por persona y noche; solo la pagada lleva ticket, sin repetirse', async () => {
    const camila = await cliente('12345678-5');
    const ignacio = await cliente('17654321-3');
    expect(await codigo(entrada(camila, 5000, 'efectivo', null))).toBe('23514');
    expect(await codigo(entrada(camila, 0, null, 1))).toBe('23514');
    expect(await codigo(entrada(camila, 5000, 'efectivo', 1))).toBe('aceptada');
    expect(await codigo(entrada(camila, 0, null, null))).toBe('23505');
    expect(await codigo(entrada(ignacio, 5000, 'tarjeta', 1))).toBe('23505');
    expect(await codigo(cliente('12345678-5'))).toBe('23505'); // el documento no se repite
  });

  it('RN-23: un sorteo por ambiente y noche; el ganador es un ticket de la noche y gana una vez', async () => {
    await entrada(await cliente('12345678-5'), 5000, 'efectivo', 1);
    const sorteo = (ambiente: number, ticket: number) =>
      app`insert into gesnoc.sorteo (fecha, ambiente_id, premio, ticket_ganador, realizado_por)
          values (${fecha}, ${ambiente}, '1 × Botella de ron', ${ticket}, ${garzon})`;
    expect(await codigo(sorteo(local.salon, 99))).toBe('23503');
    expect(await codigo(sorteo(local.salon, 1))).toBe('aceptada');
    expect(await codigo(sorteo(local.salon, 1))).toBe('23505');
    expect(await codigo(sorteo(local.terraza, 1))).toBe('23505');
  });

  it('RN-29: una mesa tiene a lo más un llamado pendiente', async () => {
    const llamar = (numero: number) =>
      app`insert into gesnoc.llamado (fecha, numero, mesa_id) values (${fecha}, ${numero}, ${mesa4})`;
    await llamar(1);
    expect(await codigo(llamar(2))).toBe('23505');
  });

  it('RN-30: un reporte lleva autor, noche y hora, y la aplicación no puede borrarlo', async () => {
    const id = await cliente('12345678-5');
    const reportar = (autor: number | null) =>
      app`insert into gesnoc.reporte (cliente_id, numero, fecha, tipo, descripcion, registrado_por)
          values (${id}, 1, ${fecha}, 'advertencia', 'Discutió en la fila', ${autor})`;
    expect(await codigo(reportar(null))).toBe('23502');
    expect(await codigo(reportar(garzon))).toBe('aceptada');
    expect(await codigo(app`delete from gesnoc.reporte where cliente_id = ${id}`)).toBe('42501');
  });
});
