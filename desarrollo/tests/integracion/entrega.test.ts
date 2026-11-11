import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { cola, entregar, marcarLista, misComandas } from '@/modules/venta/servicios/colas';
import { abrir, detalleCuenta } from '@/modules/venta/servicios/cuentas';
import { anular, enviar } from '@/modules/venta/servicios/pedidos';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar } from './apoyo';
import { fecha, linea, pedido, prepararNoche, type Local } from './noche-abierta';

conBaseVacia();

let local: Local;
let barra: number;
let cocina: number;
beforeEach(async () => {
  local = await prepararNoche();
  const estaciones = await consultar<{ id: number; nombre: string }[]>`
    select id, nombre from gesnoc.estacion`;
  barra = estaciones.find((e) => e.nombre === 'Barra Salón')!.id;
  cocina = estaciones.find((e) => e.nombre === 'Cocina')!.id;
});

/** El garzón del Salón pide 2 Mojito y 1 Papas fritas en la mesa 4; devuelve cuenta y pedido. */
async function pedirEnMesa4() {
  const garzon = local.persona('garzon');
  const { numero: cuenta } = await abrir(garzon, { mesaId: local.mesa(local.salon, 4) });
  const { numero } = await enviar(
    garzon,
    pedido(cuenta, [linea(local.producto('Mojito'), 2), linea(local.producto('Papas fritas'))], 2),
  );
  return { cuenta, numero };
}

async function registrarPago(cuenta: number, monto: number) {
  await consultar`
    insert into gesnoc.pago (fecha, cuenta_numero, numero, medio, monto, registrado_por, clave_envio)
    values (${fecha}, ${cuenta}, 1, 'efectivo', ${monto}, ${local.persona('garzon').id}, ${randomUUID()})`;
}

describe('HU-20 aviso de comanda lista', () => {
  it('CA1 y CA2: llega solo al garzón que tomó el pedido, con el número y la mesa', async () => {
    const { numero } = await pedirEnMesa4();
    await marcarLista(local.persona('barra'), numero, barra);

    const propias = await misComandas(local.persona('garzon'));
    expect(propias.listas).toEqual([
      expect.objectContaining({
        pedido: numero,
        ubicacion: 'Mesa 4',
        estacion: 'Barra Salón',
        resumen: '2 × Mojito',
      }),
    ]);
    // La cocina todavía prepara su parte.
    expect(propias.enPreparacion.map((c) => c.estacion)).toEqual(['Cocina']);

    expect((await misComandas(local.persona('garzon2'))).listas).toHaveLength(0);
    expect((await misComandas(administracion)).listas).toHaveLength(0);
  });

  it('una comanda anulada completa no avisa', async () => {
    const { cuenta, numero } = await pedirEnMesa4();
    await marcarLista(local.persona('barra'), numero, barra);
    await anular(local.persona('garzon'), { cuenta, pedido: numero, linea: 1 });
    expect((await misComandas(local.persona('garzon'))).listas).toHaveLength(0);
  });
});

describe('HU-21 marcar entregada', () => {
  it('CA1: solo se entrega una comanda lista', async () => {
    const { numero } = await pedirEnMesa4();
    await expect(entregar(local.persona('garzon'), numero, barra)).rejects.toThrow(
      'La comanda aún no está lista',
    );
  });

  it('CA2: registra la hora, apaga el aviso y sale de la estación; repetir no cambia la hora', async () => {
    const { numero } = await pedirEnMesa4();
    await marcarLista(local.persona('barra'), numero, barra);

    const entrega = await entregar(local.persona('garzon'), numero, barra);
    expect(entrega.yaEstaba).toBe(false);
    expect((await misComandas(local.persona('garzon'))).listas).toHaveLength(0);
    expect((await cola(local.persona('barra'), 'barra')).listas).toHaveLength(0);

    expect(await entregar(administracion, numero, barra)).toEqual({
      entregadaEn: entrega.entregadaEn,
      yaEstaba: true,
    });
  });

  it('RN-14: la entrega un garzón del ambiente de la cuenta, no uno de otro', async () => {
    const { numero } = await pedirEnMesa4();
    await marcarLista(local.persona('cocina'), numero, cocina);
    await expect(entregar(local.persona('garzon2'), numero, cocina)).rejects.toThrow(NoAutorizado);
    await expect(entregar(local.persona('barra'), numero, cocina)).rejects.toThrow(NoAutorizado);
  });
});

describe('HU-22 anular ítem', () => {
  it('CA2: registra quién y cuándo, no suma y la estación lo ve tachado', async () => {
    const { cuenta, numero } = await pedirEnMesa4();
    const garzon = local.persona('garzon');

    const anulada = await anular(garzon, { cuenta, pedido: numero, linea: 1 });
    expect(anulada.yaEstaba).toBe(false);
    const [fila] = await consultar<{ anulado_por: number }[]>`
      select anulado_por from gesnoc.detalle_pedido
      where fecha = ${fecha} and pedido_numero = ${numero} and linea = 1`;
    expect(fila?.anulado_por).toBe(garzon.id);

    expect((await detalleCuenta(garzon, cuenta))?.total).toBe(6500);
    const [enBarra] = (await cola(local.persona('barra'), 'barra')).pendientes;
    expect(enBarra?.anulada).toBe(true);
    expect(enBarra?.lineas[0]?.anulada).toBe(true);

    expect(await anular(garzon, { cuenta, pedido: numero, linea: 1 })).toEqual({
      anuladoEn: anulada.anuladoEn,
      yaEstaba: true,
    });
  });

  it('CA1 (RN-15): con pagos ya no se anula', async () => {
    const { cuenta, numero } = await pedirEnMesa4();
    await registrarPago(cuenta, 5000);
    await expect(
      anular(local.persona('garzon'), { cuenta, pedido: numero, linea: 1 }),
    ).rejects.toThrow('RN-15');
  });

  it('no se anula en una cuenta cerrada, de otro ambiente ni un ítem de otra cuenta', async () => {
    const { cuenta, numero } = await pedirEnMesa4();
    await expect(
      anular(local.persona('garzon2'), { cuenta, pedido: numero, linea: 1 }),
    ).rejects.toThrow(NoAutorizado);
    await expect(
      anular(local.persona('garzon'), { cuenta, pedido: numero, linea: 9 }),
    ).rejects.toThrow('Ese ítem no está en la cuenta');

    const { numero: otra } = await abrir(local.persona('garzon'), {
      mesaId: local.mesa(local.salon, 5),
    });
    await expect(
      anular(local.persona('garzon'), { cuenta: otra, pedido: numero, linea: 1 }),
    ).rejects.toThrow('Ese ítem no está en la cuenta');

    await consultar`
      update gesnoc.cuenta set cerrada_por = ${local.persona('admin').id}, cerrada_en = now()
      where fecha = ${fecha} and numero = ${cuenta}`;
    await expect(
      anular(local.persona('garzon'), { cuenta, pedido: numero, linea: 1 }),
    ).rejects.toThrow('La cuenta ya está cerrada');
  });
});

describe('HU-23 detalle de la cuenta', () => {
  it('CA1: cada pedido con sus ítems y su estado, el total, lo pagado y el saldo', async () => {
    const { cuenta, numero } = await pedirEnMesa4();
    await marcarLista(local.persona('barra'), numero, barra);
    await registrarPago(cuenta, 10000);

    const detalle = await detalleCuenta(local.persona('garzon'), cuenta);
    expect(detalle).toMatchObject({ total: 19500, pagado: 10000, saldo: 9500, seAnula: false });
    expect(detalle?.pedidos).toHaveLength(1);
    expect(detalle?.pedidos[0]?.lineas.map((l) => [l.producto, l.cantidad, l.estado])).toEqual([
      ['Mojito', 2, 'lista'],
      ['Papas fritas', 1, 'en preparación'],
    ]);
    expect(detalle?.pagos).toEqual([
      expect.objectContaining({ medio: 'efectivo', monto: 10000, confirmado: false }),
    ]);
  });

  it('RN-14: un garzón de otro ambiente no ve la cuenta', async () => {
    const { cuenta } = await pedirEnMesa4();
    await expect(detalleCuenta(local.persona('garzon2'), cuenta)).rejects.toThrow(NoAutorizado);
  });
});
