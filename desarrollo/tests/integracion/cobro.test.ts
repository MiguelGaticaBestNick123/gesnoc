import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { partePorPersona } from '@/modules/venta/cobro';
import type { MedioDePago } from '@/modules/venta/cuenta';
import { abrir, detalleCuenta, mapa } from '@/modules/venta/servicios/cuentas';
import { cobrar, miEfectivo } from '@/modules/venta/servicios/pagos';
import { enviar } from '@/modules/venta/servicios/pedidos';
import type { Actor } from '@/shared/autorizacion';
import { NoAutorizado } from '@/shared/errores';
import { conBaseVacia, consultar } from './apoyo';
import { fecha, linea, pedido, prepararNoche, total, type Local } from './noche-abierta';

conBaseVacia();

let local: Local;
let garzon: Actor;
let cuenta: number;

/** La mesa 4 del Salón con 2 Mojito y 1 Papas fritas: $19.500. */
beforeEach(async () => {
  local = await prepararNoche();
  garzon = local.persona('garzon');
  ({ numero: cuenta } = await abrir(garzon, { mesaId: local.mesa(local.salon, 4) }));
  await enviar(
    garzon,
    pedido(cuenta, [linea(local.producto('Mojito'), 2), linea(local.producto('Papas fritas'))], 2),
  );
});

const pago = (medio: MedioDePago, monto: number, propina = 0, numero = cuenta) => ({
  cuenta: numero,
  claveEnvio: randomUUID(),
  medio,
  monto,
  propina,
});

const pagosGuardados = () =>
  consultar<{ numero: number; medio: string; monto: number; propina: number }[]>`
    select numero, medio, monto, propina from gesnoc.pago order by numero`;

const estadoCuenta = async () => {
  const [fila] = await consultar<{ cerrada_en: Date | null; cerrada_por: number | null }[]>`
    select cerrada_en, cerrada_por from gesnoc.cuenta where fecha = ${fecha} and numero = ${cuenta}`;
  return fila!;
};

describe('HU-24 cobrar con medio de pago y propina', () => {
  it('CA3: el pago del saldo cierra la cuenta y la mesa queda libre', async () => {
    const hecho = await cobrar(garzon, pago('tarjeta', 19500, 1950));
    expect(hecho).toEqual({
      numero: 1,
      medio: 'tarjeta',
      monto: 19500,
      propina: 1950,
      saldo: 0,
      cerrada: true,
      repetido: false,
    });
    expect(await estadoCuenta()).toMatchObject({ cerrada_por: garzon.id });
    expect((await estadoCuenta()).cerrada_en).not.toBeNull();

    const { mesas } = await mapa(garzon);
    expect(mesas.find((m) => m.numero === 4)?.cuenta).toBeNull();
  });

  it('CA1 (RN-18): un pago que supera el saldo se rechaza y no registra nada', async () => {
    await expect(cobrar(garzon, pago('efectivo', 19510))).rejects.toThrow(
      'El monto supera el saldo de $19.500',
    );
    expect(await total('pago')).toBe(0);
    expect((await estadoCuenta()).cerrada_en).toBeNull();
  });

  it('CA2 (RN-13): un reintento con la misma clave no cobra dos veces', async () => {
    const datos = pago('efectivo', 5000, 500);
    const primero = await cobrar(garzon, datos);
    const reintento = await cobrar(garzon, datos);
    expect(reintento).toEqual({ ...primero, repetido: true });
    expect(await pagosGuardados()).toEqual([
      { numero: 1, medio: 'efectivo', monto: 5000, propina: 500 },
    ]);
  });

  it('CA2: dos reintentos simultáneos con la misma clave registran un solo pago', async () => {
    const datos = pago('tarjeta', 19500);
    const resultados = await Promise.all([cobrar(garzon, datos), cobrar(garzon, datos)]);
    expect(resultados.map((r) => r.repetido).toSorted()).toEqual([false, true]);
    expect(await total('pago')).toBe(1);
  });

  it('un reintento devuelve el pago original aunque ese pago haya cerrado la cuenta', async () => {
    const datos = pago('transferencia', 19500);
    await cobrar(garzon, datos);
    expect(await cobrar(garzon, datos)).toMatchObject({
      numero: 1,
      saldo: 0,
      cerrada: true,
      repetido: true,
    });
  });

  it('dos garzones que cobran el saldo a la vez: uno cobra y el otro se rechaza', async () => {
    const otro = local.persona('admin');
    const resultados = await Promise.allSettled([
      cobrar(garzon, pago('tarjeta', 19500)),
      cobrar(otro, pago('efectivo', 19500)),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === 'rejected');
    expect((rechazo as PromiseRejectedResult).reason).toHaveProperty(
      'message',
      'La cuenta ya está cerrada',
    );
    expect(await total('pago')).toBe(1);
  });

  it('RN-17: el efectivo queda pendiente de confirmar; la tarjeta no espera confirmación', async () => {
    await cobrar(garzon, pago('efectivo', 10000, 1000));
    await cobrar(garzon, pago('tarjeta', 9500));
    const pendientes = await consultar<{ medio: string }[]>`
      select medio from gesnoc.pago where confirmado_en is null and medio = 'efectivo'`;
    expect(pendientes).toEqual([{ medio: 'efectivo' }]);
    // La cuenta se cierra igual: el efectivo por confirmar no retiene la mesa.
    expect((await estadoCuenta()).cerrada_en).not.toBeNull();
  });

  it('RN-14: un garzón de otro ambiente no cobra y no queda nada registrado', async () => {
    await expect(cobrar(local.persona('garzon2'), pago('tarjeta', 19500))).rejects.toThrow(
      NoAutorizado,
    );
    expect(await total('pago')).toBe(0);
  });

  it('la barra y el guardia no cobran (RNF-01)', async () => {
    for (const clave of ['barra', 'guardia']) {
      await expect(cobrar(local.persona(clave), pago('tarjeta', 1000))).rejects.toThrow(
        NoAutorizado,
      );
    }
  });

  it('CU-18 4b: una cuenta cerrada no recibe pagos', async () => {
    await consultar`
      update gesnoc.cuenta set cerrada_por = ${garzon.id}, cerrada_en = now()
      where fecha = ${fecha} and numero = ${cuenta}`;
    await expect(cobrar(garzon, pago('tarjeta', 1000))).rejects.toThrow(
      'La cuenta ya está cerrada',
    );
  });

  it('una cuenta sin consumo no se cobra: se cierra sin consumo', async () => {
    const { numero } = await abrir(garzon, { mesaId: local.mesa(local.salon, 5) });
    await expect(cobrar(garzon, pago('tarjeta', 1000, 0, numero))).rejects.toThrow(
      'La cuenta no tiene saldo por cobrar',
    );
  });

  it('la clave de un cobro no sirve para otra cuenta', async () => {
    const { numero: otra } = await abrir(garzon, { mesaId: local.mesa(local.salon, 5) });
    await enviar(garzon, pedido(otra, [linea(local.producto('Schop'))]));
    const datos = pago('tarjeta', 1000);
    await cobrar(garzon, datos);
    await expect(cobrar(garzon, { ...datos, cuenta: otra })).rejects.toThrow(
      'Esa clave de envío ya se usó en otro cobro',
    );
  });

  it('RN-26: sin la noche abierta no se cobra', async () => {
    await consultar`update gesnoc.noche set cerrada_en = now() where fecha = ${fecha}`;
    await expect(cobrar(garzon, pago('tarjeta', 19500))).rejects.toThrow(
      'No hay una noche abierta',
    );
  });

  it('después de un pago parcial se puede seguir pidiendo, y el saldo sube', async () => {
    await cobrar(garzon, pago('tarjeta', 10000));
    await enviar(garzon, pedido(cuenta, [linea(local.producto('Schop'))]));
    expect(await detalleCuenta(garzon, cuenta)).toMatchObject({
      total: 23000,
      pagado: 10000,
      saldo: 13000,
    });
  });
});

describe('HU-25 dividir la cuenta', () => {
  it('CA1 y CA2: tres partes con su medio y su propina calzan exacto y cierran la cuenta', async () => {
    // Con un Schop más la cuenta suma $23.000, que no se divide exacto en tres.
    await enviar(garzon, pedido(cuenta, [linea(local.producto('Schop'))]));
    const medios: MedioDePago[] = ['efectivo', 'tarjeta', 'transferencia'];
    const propinas = [0, 770, 2000];

    let saldo = 23000;
    for (const [indice, medio] of medios.entries()) {
      const parte = partePorPersona(saldo, medios.length - indice);
      const hecho = await cobrar(garzon, pago(medio, parte, propinas[indice]));
      saldo -= parte;
      expect(hecho).toMatchObject({ numero: indice + 1, saldo, cerrada: saldo === 0 });
    }

    expect(await pagosGuardados()).toEqual([
      { numero: 1, medio: 'efectivo', monto: 7670, propina: 0 },
      { numero: 2, medio: 'tarjeta', monto: 7670, propina: 770 },
      { numero: 3, medio: 'transferencia', monto: 7660, propina: 2000 },
    ]);
    expect((await estadoCuenta()).cerrada_en).not.toBeNull();
  });

  it('CA1: un monto libre deja el resto como saldo y la cuenta sigue abierta', async () => {
    expect(await cobrar(garzon, pago('efectivo', 5000))).toMatchObject({
      saldo: 14500,
      cerrada: false,
    });
    expect(await detalleCuenta(garzon, cuenta)).toMatchObject({ pagado: 5000, saldo: 14500 });
    expect((await estadoCuenta()).cerrada_en).toBeNull();
  });

  it('dos partes cobradas a la vez nunca superan el saldo', async () => {
    const resultados = await Promise.allSettled([
      cobrar(garzon, pago('tarjeta', 10000)),
      cobrar(local.persona('admin'), pago('tarjeta', 10000)),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === 'rejected');
    expect((rechazo as PromiseRejectedResult).reason).toHaveProperty(
      'message',
      'El monto supera el saldo de $9.500',
    );
    expect(await detalleCuenta(garzon, cuenta)).toMatchObject({ pagado: 10000, saldo: 9500 });
  });
});

describe('efectivo por entregar (CU-18 paso 6)', () => {
  it('el garzón ve solo su efectivo sin confirmar, con la propina incluida', async () => {
    await cobrar(garzon, pago('efectivo', 5000, 500));
    await cobrar(garzon, pago('tarjeta', 4500));

    // Otro garzón cobra efectivo en la Terraza: no aparece en la lista del primero.
    const garzon2 = local.persona('garzon2');
    const { numero: terraza } = await abrir(garzon2, { mesaId: local.mesa(local.terraza, 1) });
    await enviar(garzon2, pedido(terraza, [linea(local.producto('Schop'))]));
    await cobrar(garzon2, pago('efectivo', 3500, 0, terraza));

    const propio = await miEfectivo(garzon);
    expect(propio).toMatchObject({ noche: fecha, total: 5500 });
    expect(propio.pagos).toEqual([
      expect.objectContaining({
        cuenta,
        ubicacion: 'Mesa 4',
        numero: 1,
        monto: 5000,
        propina: 500,
      }),
    ]);
    expect((await miEfectivo(garzon2)).total).toBe(3500);
  });

  it('lo que la administración confirma sale de la lista', async () => {
    await cobrar(garzon, pago('efectivo', 5000));
    await consultar`
      update gesnoc.pago set confirmado_por = ${local.persona('admin').id}, confirmado_en = now()`;
    expect(await miEfectivo(garzon)).toMatchObject({ pagos: [], total: 0 });
  });
});
