import { beforeEach, describe, expect, it } from 'vitest';
import { cola, marcarLista } from '@/modules/venta/servicios/colas';
import { abrir } from '@/modules/venta/servicios/cuentas';
import { enviar } from '@/modules/venta/servicios/pedidos';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar } from './apoyo';
import { fecha, linea, pedido, prepararNoche, type Local } from './noche-abierta';

conBaseVacia();

let local: Local;
beforeEach(async () => {
  local = await prepararNoche();
});

/** Un pedido con un trago y una comida desde la mesa 1 del ambiente; devuelve su número. */
async function pedidoMixto(ambiente: 'salon' | 'terraza') {
  const garzon = local.persona(ambiente === 'salon' ? 'garzon' : 'garzon2');
  const { numero: cuenta } = await abrir(garzon, { mesaId: local.mesa(local[ambiente], 1) });
  const { numero } = await enviar(
    garzon,
    pedido(
      cuenta,
      [linea(local.producto('Mojito'), 2, 'sin hielo'), linea(local.producto('Papas fritas'))],
      3,
    ),
  );
  return numero;
}

const estacionId = async (nombre: string) => {
  const [fila] = await consultar<{ id: number }[]>`
    select id from gesnoc.estacion where nombre = ${nombre}`;
  return fila!.id;
};

describe('HU-17 cola de la barra', () => {
  it('CA1: el barman ve solo las comandas de la barra de su ambiente, con lo necesario', async () => {
    const salon = await pedidoMixto('salon');
    const terraza = await pedidoMixto('terraza');

    const barraSalon = await cola(local.persona('barra'), 'barra');
    expect(barraSalon.estacion?.nombre).toBe('Barra Salón');
    expect(barraSalon.estaciones).toHaveLength(1);
    expect(barraSalon.pendientes.map((c) => c.pedido)).toEqual([salon]);
    const [comanda] = barraSalon.pendientes;
    expect(comanda).toMatchObject({ ubicacion: 'Mesa 1', garzon: 'Diego Soto', anulada: false });
    expect(comanda?.lineas).toEqual([
      { linea: 1, producto: 'Mojito', cantidad: 2, nota: 'sin hielo', anulada: false },
    ]);
    expect(comanda?.espera).toBeGreaterThanOrEqual(0);

    const barraTerraza = await cola(local.persona('barra2'), 'barra');
    expect(barraTerraza.pendientes.map((c) => c.pedido)).toEqual([terraza]);
  });

  it('la administración elige cualquier barra', async () => {
    const terraza = await pedidoMixto('terraza');
    const vista = await cola(administracion, 'barra', await estacionId('Barra Terraza'));
    expect(vista.estaciones.map((e) => e.nombre)).toEqual(['Barra Salón', 'Barra Terraza']);
    expect(vista.pendientes.map((c) => c.pedido)).toEqual([terraza]);
  });

  it('el garzón no ve colas', async () => {
    await expect(cola(local.persona('garzon'), 'barra')).rejects.toThrow(NoAutorizado);
  });
});

describe('HU-18 cola de la cocina', () => {
  it('CA1 y CA2: sin bebidas, con el número de personas, de los dos ambientes', async () => {
    const salon = await pedidoMixto('salon');
    const terraza = await pedidoMixto('terraza');

    const cocina = await cola(local.persona('cocina'), 'cocina');
    expect(cocina.pendientes.map((c) => c.pedido)).toEqual([salon, terraza]);
    expect(cocina.pendientes.flatMap((c) => c.lineas.map((l) => l.producto))).toEqual([
      'Papas fritas',
      'Papas fritas',
    ]);
    expect(cocina.pendientes.map((c) => [c.ambiente, c.personas])).toEqual([
      ['Salón', 3],
      ['Terraza', 3],
    ]);
  });
});

describe('HU-19 marcar lista', () => {
  it('CA1: registra la hora y la comanda pasa a «listas para retirar»', async () => {
    const numero = await pedidoMixto('salon');
    const barra = await estacionId('Barra Salón');

    const marca = await marcarLista(local.persona('barra'), numero, barra);
    expect(marca.yaEstaba).toBe(false);

    const vista = await cola(local.persona('barra'), 'barra');
    expect(vista.pendientes).toHaveLength(0);
    expect(vista.listas.map((c) => c.pedido)).toEqual([numero]);
    // La cocina sigue preparando su parte del mismo pedido.
    expect((await cola(local.persona('cocina'), 'cocina')).pendientes).toHaveLength(1);
  });

  it('CA2: dos dispositivos que marcan a la vez dejan una sola hora', async () => {
    const numero = await pedidoMixto('salon');
    const barra = await estacionId('Barra Salón');
    const barman = local.persona('barra');

    const marcas = await Promise.all([
      marcarLista(barman, numero, barra),
      marcarLista(barman, numero, barra),
    ]);
    expect(marcas.map((m) => m.yaEstaba).sort()).toEqual([false, true]);
    expect(marcas[0]?.listaEn).toBe(marcas[1]?.listaEn);

    const otra = await marcarLista(administracion, numero, barra);
    expect(otra).toEqual({ listaEn: marcas[0]?.listaEn, yaEstaba: true });
  });

  it('RN-14: solo marca quien atiende esa estación', async () => {
    const numero = await pedidoMixto('salon');
    const barra = await estacionId('Barra Salón');

    for (const persona of ['barra2', 'cocina', 'garzon', 'guardia']) {
      await expect(marcarLista(local.persona(persona), numero, barra)).rejects.toThrow(
        NoAutorizado,
      );
    }
    await expect(
      marcarLista(local.persona('cocina'), numero, await estacionId('Cocina')),
    ).resolves.toMatchObject({ yaEstaba: false });
  });

  it('no marca una comanda que no existe ni una anulada completa', async () => {
    const numero = await pedidoMixto('salon');
    const barra = await estacionId('Barra Salón');
    const barman = local.persona('barra');

    await expect(marcarLista(barman, numero + 1, barra)).rejects.toThrow('Esa comanda no existe');

    await consultar`
      update gesnoc.detalle_pedido set anulado_por = ${barman.id}, anulado_en = now()
      where fecha = ${fecha} and pedido_numero = ${numero} and estacion_id = ${barra}`;
    await expect(marcarLista(barman, numero, barra)).rejects.toThrow('se anuló completa');
    // CU-16 2b: se ve tachada mientras tanto.
    expect((await cola(barman, 'barra')).pendientes[0]?.anulada).toBe(true);
  });
});

describe('sin noche abierta', () => {
  it('no hay cola ni se marca nada (RN-26)', async () => {
    const numero = await pedidoMixto('salon');
    const barra = await estacionId('Barra Salón');
    await consultar`update gesnoc.noche set cerrada_en = now() where fecha = ${fecha}`;

    const vista = await cola(administracion, 'barra');
    expect(vista.noche).toBeNull();
    expect(vista.pendientes).toHaveLength(0);
    await expect(marcarLista(administracion, numero, barra)).rejects.toThrow(
      'No hay una noche abierta',
    );
  });
});
