import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as noches from '@/modules/noche/servicios/noches';
import type { DatosPedido } from '@/modules/venta/esquemas';
import { abrir, cerrarSinConsumo, mapa, pantallaPedido } from '@/modules/venta/servicios/cuentas';
import { enviar } from '@/modules/venta/servicios/pedidos';
import type { Actor, RolTurno } from '@/shared/autorizacion';
import { NoAutorizado } from '@/shared/errores';
import { correoDe, sembrar } from '../../db/seeds/demostracion';
import { administracion, CLAVE, conBaseVacia, consultar } from './apoyo';

conBaseVacia();

const fecha = '2026-11-07';

interface Local {
  salon: number;
  terraza: number;
  mesa: (ambiente: number, numero: number) => number;
  producto: (nombre: string) => number;
  persona: (clave: string) => Actor;
}

// El local de demostración con la noche abierta: dos ambientes, sus estaciones y la dotación.
async function prepararNoche({ abrirNoche = true } = {}): Promise<Local> {
  await sembrar(consultar, CLAVE, fecha);
  if (abrirNoche) await noches.abrir(administracion, fecha, 0);

  const ambientes = await consultar<{ id: number; nombre: string }[]>`
    select id, nombre from gesnoc.ambiente`;
  const mesas = await consultar<{ id: number; ambiente_id: number; numero: number }[]>`
    select id, ambiente_id, numero from gesnoc.mesa`;
  const productos = await consultar<{ id: number; nombre: string }[]>`
    select id, nombre from gesnoc.producto`;
  const personas = await consultar<
    { id: number; correo: string; rol: RolTurno | null; ambiente_id: number | null }[]
  >`
    select u.id, u.correo, a.rol, a.ambiente_id from gesnoc.usuario u
    left join gesnoc.asignacion a on a.usuario_id = u.id and a.fecha = ${fecha}`;

  const idDe = (nombre: string) => ambientes.find((a) => a.nombre === nombre)!.id;
  return {
    salon: idDe('Salón'),
    terraza: idDe('Terraza'),
    mesa: (ambiente, numero) =>
      mesas.find((m) => m.ambiente_id === ambiente && m.numero === numero)!.id,
    producto: (nombre) => productos.find((p) => p.nombre === nombre)!.id,
    persona: (clave) => {
      const fila = personas.find((p) => p.correo === correoDe(clave))!;
      return {
        id: fila.id,
        nombre: clave,
        esAdministrador: clave === 'admin',
        turno:
          abrirNoche && fila.rol ? { fecha, rol: fila.rol, ambienteId: fila.ambiente_id } : null,
      };
    },
  };
}

const total = async (tabla: string) => {
  const [fila] = await consultar<{ n: number }[]>`
    select count(*)::int as n from ${consultar('gesnoc')}.${consultar(tabla)}`;
  return fila!.n;
};

const pedido = (cuenta: number, lineas: DatosPedido['lineas'], personas: number | null = null) => ({
  cuenta,
  claveEnvio: randomUUID(),
  personas,
  lineas,
});

const linea = (productoId: number, cantidad = 1, nota: string | null = null) => ({
  productoId,
  cantidad,
  nota,
});

describe('HU-13 mapa de mesas', () => {
  let local: Local;
  beforeEach(async () => {
    local = await prepararNoche();
  });

  it('CA1: una mesa está ocupada mientras tiene una cuenta abierta', async () => {
    const garzon = local.persona('garzon');
    await abrir(garzon, { mesaId: local.mesa(local.salon, 4) });

    const { mesas } = await mapa(garzon);
    const ocupadas = mesas.filter((m) => m.cuenta !== null);
    expect(ocupadas).toHaveLength(1);
    expect(ocupadas[0]).toMatchObject({ numero: 4, cuenta: 1 });
    expect(mesas).toHaveLength(12);
  });

  it('el garzón ve solo el ambiente de su turno, aunque pida otro', async () => {
    const vista = await mapa(local.persona('garzon2'), local.salon);
    expect(vista.ambiente.nombre).toBe('Terraza');
    expect(vista.ambientes).toHaveLength(1);
  });

  it('la administración elige cualquier ambiente', async () => {
    const vista = await mapa(local.persona('admin'), local.terraza);
    expect(vista.ambiente.nombre).toBe('Terraza');
    expect(vista.ambientes.map((a) => a.nombre)).toEqual(['Salón', 'Terraza']);
  });

  it('las cuentas de clientes de pie aparecen en su ambiente', async () => {
    const garzon = local.persona('garzon');
    await abrir(garzon, { ambienteId: local.salon, referencia: 'polera roja' });
    const { dePie } = await mapa(garzon);
    expect(dePie).toMatchObject([{ numero: 1, referencia: 'polera roja' }]);
  });

  it('el guardia y la barra no ven el mapa (RNF-01)', async () => {
    await expect(mapa(local.persona('guardia'))).rejects.toThrow(NoAutorizado);
    await expect(mapa(local.persona('barra'))).rejects.toThrow(NoAutorizado);
  });
});

describe('HU-14 abrir una cuenta', () => {
  let local: Local;
  beforeEach(async () => {
    local = await prepararNoche();
  });

  it('las cuentas llevan un correlativo de la noche', async () => {
    const garzon = local.persona('garzon');
    expect(await abrir(garzon, { mesaId: local.mesa(local.salon, 1) })).toEqual({
      numero: 1,
      existente: false,
    });
    expect(await abrir(garzon, { ambienteId: local.salon, referencia: 'barra' })).toEqual({
      numero: 2,
      existente: false,
    });
  });

  it('CA1: en una mesa ocupada se muestra su cuenta, sin abrir otra (RN-06)', async () => {
    const mesaId = local.mesa(local.salon, 3);
    await abrir(local.persona('garzon'), { mesaId });
    expect(await abrir(local.persona('admin'), { mesaId })).toEqual({ numero: 1, existente: true });
    expect(await total('cuenta')).toBe(1);
  });

  it('CA1: dos teléfonos que abren la misma mesa a la vez llegan a la misma cuenta', async () => {
    const mesaId = local.mesa(local.salon, 5);
    const garzon = local.persona('garzon');
    const [a, b] = await Promise.all([abrir(garzon, { mesaId }), abrir(garzon, { mesaId })]);
    expect(a.numero).toBe(b.numero);
    expect(await total('cuenta')).toBe(1);
  });

  it('RN-14: un garzón no abre cuentas en otro ambiente', async () => {
    const garzon = local.persona('garzon');
    await expect(abrir(garzon, { mesaId: local.mesa(local.terraza, 1) })).rejects.toThrow(
      NoAutorizado,
    );
    await expect(
      abrir(garzon, { ambienteId: local.terraza, referencia: 'gorro verde' }),
    ).rejects.toThrow(NoAutorizado);
    expect(await total('cuenta')).toBe(0);
  });

  it('una mesa retirada no admite cuentas', async () => {
    const mesaId = local.mesa(local.salon, 2);
    await consultar`update gesnoc.mesa set activa = false where id = ${mesaId}`;
    await expect(abrir(local.persona('admin'), { mesaId })).rejects.toThrow('Esa mesa no existe');
  });
});

describe('sin noche abierta', () => {
  it('nadie abre cuentas, ni siquiera la administración (RN-26)', async () => {
    const local = await prepararNoche({ abrirNoche: false });
    await expect(
      abrir(local.persona('admin'), { mesaId: local.mesa(local.salon, 1) }),
    ).rejects.toThrow('No hay una noche abierta');
  });
});

describe('cerrar una cuenta sin consumo', () => {
  let local: Local;
  beforeEach(async () => {
    local = await prepararNoche();
  });

  it('una cuenta abierta por error se cierra y la mesa queda libre', async () => {
    const garzon = local.persona('garzon');
    await abrir(garzon, { mesaId: local.mesa(local.salon, 6) });
    await cerrarSinConsumo(garzon, 1);

    const { mesas } = await mapa(garzon);
    expect(mesas.every((m) => m.cuenta === null)).toBe(true);
    const [fila] = await consultar<
      { cerrada_por: number }[]
    >`select cerrada_por from gesnoc.cuenta`;
    expect(fila!.cerrada_por).toBe(garzon.id);
  });

  it('una cuenta con consumo no se cierra así: se cobra', async () => {
    const garzon = local.persona('garzon');
    await abrir(garzon, { mesaId: local.mesa(local.salon, 6) });
    await enviar(garzon, pedido(1, [linea(local.producto('Mojito'))]));
    await expect(cerrarSinConsumo(garzon, 1)).rejects.toThrow('se cierra al cobrar el saldo');
  });

  it('no se cierra dos veces ni desde otro ambiente', async () => {
    await abrir(local.persona('garzon'), { mesaId: local.mesa(local.salon, 6) });
    await expect(cerrarSinConsumo(local.persona('garzon2'), 1)).rejects.toThrow(NoAutorizado);
    await cerrarSinConsumo(local.persona('admin'), 1);
    await expect(cerrarSinConsumo(local.persona('garzon'), 1)).rejects.toThrow('ya está cerrada');
  });
});

describe('HU-15 catálogo para armar el pedido', () => {
  let local: Local;
  beforeEach(async () => {
    local = await prepararNoche();
  });

  it('marca lo que va a cocina para pedir el número de personas (RN-12)', async () => {
    const garzon = local.persona('garzon');
    await abrir(garzon, { mesaId: local.mesa(local.salon, 1) });
    const pantalla = await pantallaPedido(garzon, 1);
    const papas = pantalla!.productos.find((p) => p.nombre === 'Papas fritas');
    const mojito = pantalla!.productos.find((p) => p.nombre === 'Mojito');
    expect(papas).toMatchObject({ paraCocina: true, sinDestino: false });
    expect(mojito).toMatchObject({ paraCocina: false, sinDestino: false });
  });

  it('un producto inactivo no se ofrece (HU-06 CA3)', async () => {
    const garzon = local.persona('garzon');
    await consultar`update gesnoc.producto set activo = false where nombre = 'Mojito'`;
    await abrir(garzon, { mesaId: local.mesa(local.salon, 1) });
    const pantalla = await pantallaPedido(garzon, 1);
    expect(pantalla!.productos.map((p) => p.nombre)).not.toContain('Mojito');
  });

  it('un garzón no abre la cuenta de otro ambiente', async () => {
    await abrir(local.persona('garzon2'), { mesaId: local.mesa(local.terraza, 1) });
    await expect(pantallaPedido(local.persona('garzon'), 1)).rejects.toThrow(NoAutorizado);
  });
});

describe('HU-16 enviar el pedido', () => {
  let local: Local;
  let garzon: Actor;
  beforeEach(async () => {
    local = await prepararNoche();
    garzon = local.persona('garzon');
    await abrir(garzon, { mesaId: local.mesa(local.salon, 1) });
  });

  const comandasDe = (numero: number) =>
    consultar<{ estacion: string; lineas: number }[]>`
      select e.nombre as estacion, count(d.*)::int as lineas
      from gesnoc.comanda c
      join gesnoc.estacion e on e.id = c.estacion_id
      join gesnoc.detalle_pedido d on d.fecha = c.fecha and d.pedido_numero = c.pedido_numero
        and d.estacion_id = c.estacion_id
      where c.pedido_numero = ${numero}
      group by e.nombre order by e.nombre`;

  it('CA1: cada ítem va a su estación y hay una comanda por estación (RN-10, RN-11)', async () => {
    const enviado = await enviar(
      garzon,
      pedido(
        1,
        [
          linea(local.producto('Mojito'), 2),
          linea(local.producto('Papas fritas')),
          linea(local.producto('Schop')),
        ],
        3,
      ),
    );
    expect(enviado).toEqual({ numero: 1, estaciones: ['Barra Salón', 'Cocina'], repetido: false });
    expect(await comandasDe(1)).toEqual([
      { estacion: 'Barra Salón', lineas: 2 },
      { estacion: 'Cocina', lineas: 1 },
    ]);
  });

  it('la regla «barra del ambiente» usa la barra del ambiente de la cuenta', async () => {
    const garzon2 = local.persona('garzon2');
    await abrir(garzon2, { mesaId: local.mesa(local.terraza, 1) });
    const enviado = await enviar(garzon2, pedido(2, [linea(local.producto('Mojito'))]));
    expect(enviado.estaciones).toEqual(['Barra Terraza']);
  });

  it('un producto con estación propia manda sobre la regla de su categoría (RN-10)', async () => {
    await consultar`
      update gesnoc.producto set estacion_id = (select id from gesnoc.estacion where nombre = 'Cocina')
      where nombre = 'Agua mineral'`;
    const enviado = await enviar(garzon, pedido(1, [linea(local.producto('Agua mineral'))], 1));
    expect(enviado.estaciones).toEqual(['Cocina']);
  });

  it('CA3: guarda el precio vigente y un cambio posterior no lo altera (RN-09)', async () => {
    await enviar(garzon, pedido(1, [linea(local.producto('Mojito'))]));
    await consultar`update gesnoc.producto set precio = 9900 where nombre = 'Mojito'`;
    const [fila] = await consultar<{ precio_unitario: number }[]>`
      select precio_unitario from gesnoc.detalle_pedido`;
    expect(fila!.precio_unitario).toBe(6500);
  });

  it('CA3: un pedido con comida exige el número de personas (RN-12)', async () => {
    await expect(
      enviar(garzon, pedido(1, [linea(local.producto('Papas fritas'))])),
    ).rejects.toThrow('número de personas');
    expect(await total('pedido')).toBe(0);
  });

  it('sin comida no se guarda el número de personas', async () => {
    await enviar(garzon, pedido(1, [linea(local.producto('Schop'))], 4));
    const [fila] = await consultar<
      { personas: number | null }[]
    >`select personas from gesnoc.pedido`;
    expect(fila!.personas).toBeNull();
  });

  it('CA2: un reintento con la misma clave no duplica el pedido (RN-13)', async () => {
    const datos = pedido(1, [linea(local.producto('Mojito'))]);
    const primero = await enviar(garzon, datos);
    const reintento = await enviar(garzon, datos);
    expect(reintento).toEqual({ ...primero, repetido: true });
    expect(await total('pedido')).toBe(1);
    expect(await total('detalle_pedido')).toBe(1);
  });

  it('CA2: dos envíos simultáneos con la misma clave registran un solo pedido', async () => {
    const datos = pedido(1, [linea(local.producto('Mojito'))]);
    const resultados = await Promise.all([enviar(garzon, datos), enviar(garzon, datos)]);
    expect(new Set(resultados.map((r) => r.numero)).size).toBe(1);
    expect(await total('pedido')).toBe(1);
  });

  it('un reintento devuelve el pedido original aunque la cuenta ya se haya cerrado', async () => {
    const datos = pedido(1, [linea(local.producto('Mojito'))]);
    await enviar(garzon, datos);
    await consultar`update gesnoc.cuenta set cerrada_por = ${garzon.id}, cerrada_en = now()`;
    expect(await enviar(garzon, datos)).toMatchObject({ numero: 1, repetido: true });
  });

  it('los pedidos simultáneos reciben números distintos y correlativos', async () => {
    for (let mesa = 2; mesa <= 6; mesa++) {
      await abrir(garzon, { mesaId: local.mesa(local.salon, mesa) });
    }
    const numeros = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((cuenta) =>
        enviar(garzon, pedido(cuenta, [linea(local.producto('Schop'))])).then((r) => r.numero),
      ),
    );
    expect(numeros.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('RN-14: un garzón de otro ambiente no pide en la cuenta y no queda nada registrado', async () => {
    await expect(
      enviar(local.persona('garzon2'), pedido(1, [linea(local.producto('Mojito'))])),
    ).rejects.toThrow(NoAutorizado);
    expect(await total('pedido')).toBe(0);
  });

  it('un producto desactivado mientras se armaba el pedido se informa y no se envía', async () => {
    await consultar`update gesnoc.producto set activo = false where nombre = 'Mojito'`;
    await expect(
      enviar(garzon, pedido(1, [linea(local.producto('Schop')), linea(local.producto('Mojito'))])),
    ).rejects.toThrow('Mojito ya no está disponible');
    expect(await total('pedido')).toBe(0);
  });

  it('si el ambiente no tiene barra, el pedido no se envía', async () => {
    await consultar`
      insert into gesnoc.ambiente (nombre, plano_ancho, plano_alto) values ('Patio', 400, 400)`;
    await consultar`
      insert into gesnoc.cuenta (fecha, numero, ambiente_id, referencia, abierta_por)
      values (${fecha}, 9, (select id from gesnoc.ambiente where nombre = 'Patio'), 'fogón',
              ${garzon.id})`;
    await expect(
      enviar(local.persona('admin'), pedido(9, [linea(local.producto('Mojito'))])),
    ).rejects.toThrow('no tiene barra configurada');
  });

  it('una cuenta cerrada no recibe pedidos', async () => {
    await cerrarSinConsumo(garzon, 1);
    await expect(enviar(garzon, pedido(1, [linea(local.producto('Mojito'))]))).rejects.toThrow(
      'La cuenta ya está cerrada',
    );
  });

  it('guarda quién tomó el pedido y la nota de cada ítem', async () => {
    await enviar(garzon, pedido(1, [linea(local.producto('Mojito'), 1, 'sin azúcar')]));
    const [fila] = await consultar<{ tomado_por: number; nota: string }[]>`
      select p.tomado_por, d.nota from gesnoc.pedido p
      join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero`;
    expect(fila).toEqual({ tomado_por: garzon.id, nota: 'sin azúcar' });
  });
});
