import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { datosMensaje } from '@/modules/chat/esquemas';
import { enviarMensaje, estadoDelChat } from '@/modules/chat/servicios/chat';
import { historialDeComandas } from '@/modules/venta/servicios/historial';
import { marcarLista } from '@/modules/venta/servicios/colas';
import { abrir } from '@/modules/venta/servicios/cuentas';
import { enviar } from '@/modules/venta/servicios/pedidos';
import { NoAutorizado } from '@/shared/errores';
import { conBaseVacia, consultar, sinTurno } from './apoyo';
import { linea, pedido, prepararNoche, type Local } from './noche-abierta';

// Chat del personal e historial de comandas (pedidos del Product Owner, 18 nov).

conBaseVacia();

let local: Local;
beforeEach(async () => {
  local = await prepararNoche();
});

const mensaje = (canal: string, texto: string, claveEnvio = randomUUID()) =>
  datosMensaje.parse({ canal, texto, claveEnvio });

describe('chat del personal', () => {
  it('cada persona lee el general y el de su rol; la administración, todos', async () => {
    const garzon = local.persona('garzon');
    await enviarMensaje(garzon, mensaje('general', 'Se acabó el limón'));
    await enviarMensaje(local.persona('barra'), mensaje('barman', 'Repongan hielo'));
    await enviarMensaje(garzon, mensaje('garzon', 'Mesa 5 pide la cuenta'));

    const delGarzon = await estadoDelChat(garzon);
    expect(delGarzon.canales).toEqual(['general', 'garzon']);
    expect(delGarzon.mensajes.map((m) => [m.numero, m.canal, m.texto])).toEqual([
      [1, 'general', 'Se acabó el limón'],
      [3, 'garzon', 'Mesa 5 pide la cuenta'],
    ]);
    expect(delGarzon.mensajes[0]).toMatchObject({ autor: 'Diego Soto', puesto: 'garzon' });

    const delGuardia = await estadoDelChat(local.persona('guardia'));
    expect(delGuardia.mensajes.map((m) => m.texto)).toEqual(['Se acabó el limón']);

    const admin = local.persona('admin');
    const deLaAdministracion = await estadoDelChat(admin);
    expect(deLaAdministracion.canales).toHaveLength(5);
    expect(deLaAdministracion.mensajes).toHaveLength(3);
    await enviarMensaje(admin, mensaje('cocinero', 'Cierra la cocina a las 3'));
    const [cocina] = (await estadoDelChat(local.persona('cocina'))).mensajes.filter(
      (m) => m.canal === 'cocinero',
    );
    expect(cocina).toMatchObject({ autor: 'Carla Muñoz', puesto: 'admin' });
  });

  it('nadie escribe en el canal de otro rol', async () => {
    await expect(
      enviarMensaje(local.persona('garzon'), mensaje('cocinero', 'Apuren las papas')),
    ).rejects.toThrow(NoAutorizado);
  });

  it('sin turno o sin noche abierta no hay chat, y la consulta no falla', async () => {
    expect(await estadoDelChat(sinTurno())).toMatchObject({ canales: [], mensajes: [] });
    await consultar`update gesnoc.noche set cerrada_en = now() where cerrada_en is null
                    and abierta_en is not null`;
    expect(await estadoDelChat(local.persona('admin'))).toMatchObject({
      noche: null,
      canales: [],
    });
    await expect(enviarMensaje(local.persona('admin'), mensaje('general', 'Hola'))).rejects.toThrow(
      'No hay una noche abierta',
    );
  });

  it('un reintento con la misma clave de envío no duplica el mensaje (RN-13)', async () => {
    const garzon = local.persona('garzon');
    const clave = randomUUID();
    const primero = await enviarMensaje(garzon, mensaje('general', 'Llegó el DJ', clave));
    const reintento = await enviarMensaje(garzon, mensaje('general', 'Llegó el DJ', clave));
    expect(reintento).toEqual({ numero: primero.numero, repetido: true });
    await expect(
      enviarMensaje(local.persona('barra'), mensaje('general', 'Otro', clave)),
    ).rejects.toThrow('Esa clave de envío ya se usó en otro mensaje');
    const [fila] = await consultar<{ n: number }[]>`
      select count(*)::int as n from gesnoc.mensaje`;
    expect(fila!.n).toBe(1);
  });

  it('dos mensajes a la vez reciben números distintos y seguidos', async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        enviarMensaje(local.persona(i % 2 ? 'garzon' : 'barra'), mensaje('general', `M${i}`)),
      ),
    );
    const numeros = (await estadoDelChat(local.persona('admin'))).mensajes.map((m) => m.numero);
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('la aplicación no puede editar ni borrar un mensaje', async () => {
    await enviarMensaje(local.persona('garzon'), mensaje('general', 'Queda'));
    const { db } = await import('@/shared/db/cliente');
    const { sql } = await import('drizzle-orm');
    await expect(db().execute(sql`delete from gesnoc.mensaje`)).rejects.toThrow();
    await expect(db().execute(sql`update gesnoc.mensaje set texto = 'Otro'`)).rejects.toThrow();
  });
});

describe('historial de comandas', () => {
  it('garzón, barra, cocina y administración ven cada pedido con su hora, mesa y estado', async () => {
    const garzon = local.persona('garzon');
    const { numero: cuenta } = await abrir(garzon, { mesaId: local.mesa(local.salon, 4) });
    const { numero } = await enviar(
      garzon,
      pedido(cuenta, [linea(local.producto('Mojito')), linea(local.producto('Papas fritas'))], 2),
    );
    const [barra] = await consultar<{ id: number }[]>`
      select id from gesnoc.estacion where nombre = 'Barra Salón'`;
    await marcarLista(local.persona('barra'), numero, barra!.id);

    const deLaBarra = await historialDeComandas(local.persona('barra'), 'barra');
    expect(deLaBarra.estacionInicial).toBe(barra!.id);
    expect(deLaBarra.pedidos).toHaveLength(1);
    const [visto] = deLaBarra.pedidos;
    expect(visto).toMatchObject({
      pedido: numero,
      ubicacion: 'Mesa 4',
      ambiente: 'Salón',
      garzon: 'Diego Soto',
      personas: 2,
    });
    expect(visto!.hora).toMatch(/^\d{2}:\d{2}$/);
    expect(visto!.comandas.map((c) => [c.estacion, c.estado])).toEqual([
      ['Barra Salón', 'lista'],
      ['Cocina', 'pendiente'],
    ]);

    for (const [clave, permiso] of [
      ['garzon', 'garzon'],
      ['cocina', 'cocina'],
      ['admin', 'admin'],
    ] as const) {
      const vista = await historialDeComandas(local.persona(clave), permiso);
      expect(vista.pedidos.map((p) => p.pedido)).toEqual([numero]);
    }
    // La guardia no ve el historial.
    await expect(historialDeComandas(local.persona('guardia'), 'barra')).rejects.toThrow(
      NoAutorizado,
    );
  });
});
