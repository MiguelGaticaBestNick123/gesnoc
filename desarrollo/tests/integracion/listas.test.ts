import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as caja from '@/modules/caja/servicios/caja';
import { detalleDeNoche } from '@/modules/noche/servicios/detalles';
import * as listas from '@/modules/noche/servicios/listas';
import * as noches from '@/modules/noche/servicios/noches';
import { datosEntrada, type DatosEntrada } from '@/modules/porteria/esquemas';
import { buscar, registrar } from '@/modules/porteria/servicios/puerta';
import type { Actor } from '@/shared/autorizacion';
import { digitoVerificador } from '@/shared/utilidades/rut';
import { correoDe, sembrar } from '../../db/seeds/demostracion';
import { CLAVE, conBaseVacia, consultar, fijarReloj, relojReal } from './apoyo';

// Listas con vigencia (pedido del Product Owner, 18 nov): de una noche, de varias o sin término.
// El local de demostración con «hoy» el sábado 7 de noviembre: esa noche tiene el cumpleaños de
// Camila (paga) y los bailarines (gratis), y la lista sin término de los clientes frecuentes vale
// desde el 24 de octubre (Andrés Valdés, Paz Cifuentes y Rodrigo Lillo).

conBaseVacia();

const SABADO = '2026-11-07';
const DOMINGO = '2026-11-08';
const OTRO_SABADO = '2026-11-14';
beforeAll(() => fijarReloj(SABADO));
afterAll(relojReal);

const ANDRES = '12765432-8';
const PAZ = '14321987-9';
const CAMILA = '15678234-3';
const IGNACIO = '17654321-3';
const MARTINA = '20123456-5';
const FELIPE = '16543210-K';

const personaId = async (clave: string) => {
  const [fila] = await consultar<{ id: number }[]>`
    select id from gesnoc.usuario where correo = ${correoDe(clave)}`;
  return fila!.id;
};
const admin = async (): Promise<Actor> => ({
  id: await personaId('admin'),
  nombre: 'Carla Muñoz',
  esAdministrador: true,
  turno: null,
});
const guardia = async (fecha: string): Promise<Actor> => ({
  id: await personaId('guardia'),
  nombre: 'Bruno Pérez',
  esAdministrador: false,
  turno: { fecha, rol: 'guardia', ambienteId: null },
});

const idDeLista = async (nombre: string) => {
  const [fila] = await consultar<{ id: number }[]>`
    select id from gesnoc.lista where nombre = ${nombre}`;
  return fila!.id;
};

const entrada = (documento: string, forma: DatosEntrada['forma']) =>
  datosEntrada.parse({
    tipoDocumento: 'rut',
    documento,
    nombre: 'Persona',
    apellido: 'De Prueba',
    forma,
    monto: forma === 'gratis' ? 0 : 5000,
  });

/** La lista con que entró la persona esa noche (`null` si no venía en una). */
const listaDeLaEntrada = async (fecha: string, documento: string) => {
  const [fila] = await consultar<{ lista_id: number | null }[]>`
    select e.lista_id from gesnoc.entrada e join gesnoc.cliente c on c.id = e.cliente_id
    where e.fecha = ${fecha} and c.documento = ${documento}`;
  return fila?.lista_id;
};

/** Cuenta la caja (sin ventas: el fondo más lo que entró en efectivo) y cierra la noche. */
async function cerrar(fecha: string, efectivo: number) {
  const actor = await admin();
  await caja.contar(actor, efectivo, null);
  return caja.cerrarNoche(actor, fecha);
}

describe('listas con vigencia en la puerta (HU-33 y HU-34, ajuste del 18 nov)', () => {
  it('cada lista vale sus noches; la entrada guarda con qué lista entró y quitar a alguien no lo borra', async () => {
    await sembrar(consultar, CLAVE, SABADO);
    const frecuentes = await idDeLista('Clientes frecuentes');
    const cumpleanos = await idDeLista('Cumpleaños de Camila');

    // --- Sábado: el cumpleaños, los bailarines y los clientes frecuentes ---
    await noches.abrir(await admin(), SABADO, 0);
    const puerta = await guardia(SABADO);
    expect((await buscar(puerta, PAZ)).invitacion).toEqual({
      nombre: 'Paz',
      apellido: 'Cifuentes',
      gratis: true,
      invitadoPor: null,
      lista: 'Clientes frecuentes',
      responsable: 'Carla Muñoz',
    });
    await registrar(puerta, entrada(PAZ, 'gratis'));
    await registrar(puerta, entrada(CAMILA, 'efectivo'));
    await registrar(puerta, entrada(FELIPE, 'gratis'));
    // HU-33 CA2: la entrada queda vinculada a la lista; la invitación individual se deduce.
    expect(await listaDeLaEntrada(SABADO, PAZ)).toBe(frecuentes);
    expect(await listaDeLaEntrada(SABADO, CAMILA)).toBe(cumpleanos);
    expect(await listaDeLaEntrada(SABADO, FELIPE)).toBeNull();

    // Ignacio viene al cumpleaños (paga), pero también es cliente frecuente: entra gratis.
    await listas.agregarIntegrante(await admin(), {
      listaId: frecuentes,
      documento: IGNACIO,
      nombre: 'Ignacio',
      apellido: 'Bravo',
    });
    expect((await buscar(puerta, IGNACIO)).invitacion).toMatchObject({
      lista: 'Clientes frecuentes',
      gratis: true,
    });
    await registrar(puerta, entrada(IGNACIO, 'gratis'));
    expect(await listaDeLaEntrada(SABADO, IGNACIO)).toBe(frecuentes);

    // La página de la noche marca quién entró en cada lista.
    const sabado = (await detalleDeNoche(await admin(), SABADO))!;
    const deFrecuentes = sabado.listas.find((l) => l.id === frecuentes)!;
    expect(deFrecuentes.personas.filter((p) => p.entroEn).map((p) => p.nombre)).toEqual([
      'Ignacio',
      'Paz',
    ]);
    await cerrar(SABADO, 5000);

    // --- Domingo: el cumpleaños ya terminó; los clientes frecuentes siguen ---
    await noches.abrir(await admin(), DOMINGO, 0);
    const domingo = await guardia(DOMINGO);
    expect((await buscar(domingo, CAMILA)).invitacion).toBeNull();
    expect((await buscar(domingo, ANDRES)).invitacion).toMatchObject({
      lista: 'Clientes frecuentes',
    });
    // Una lista que terminó queda como registro: no cambia (RN-26).
    await expect(
      listas.agregarIntegrante(await admin(), {
        listaId: cumpleanos,
        documento: MARTINA,
        nombre: 'Martina',
        apellido: 'Herrera',
      }),
    ).rejects.toThrow(
      'Esa lista terminó el sábado, 7 de noviembre: queda como registro y no cambia',
    );

    // HU-34 CA2: sacar a Paz de la lista no borra cómo entró el sábado.
    await listas.quitarIntegrante(await admin(), frecuentes, PAZ);
    expect((await buscar(domingo, PAZ)).invitacion).toBeNull();
    expect(await listaDeLaEntrada(SABADO, PAZ)).toBe(frecuentes);

    // Con ella entró gente: quitarla la termina la noche anterior y queda como registro.
    await listas.quitarLista(await admin(), frecuentes);
    const [terminada] = await consultar<{ hasta: string }[]>`
      select hasta::text from gesnoc.lista where id = ${frecuentes}`;
    expect(terminada!.hasta).toBe(SABADO);
    expect((await buscar(domingo, ANDRES)).invitacion).toBeNull();
    expect((await listas.pantallaListas(await admin())).listas.map((l) => l.nombre)).toEqual([]);
    // Desde el sábado, que ya cerró, se sigue viendo como era, de solo lectura.
    const vistaDelSabado = (await detalleDeNoche(await admin(), SABADO))!.listas;
    expect(vistaDelSabado.map((l) => [l.nombre, l.editable])).toEqual([
      ['Bailarines', false],
      ['Cumpleaños de Camila', false],
      ['Clientes frecuentes', false],
    ]);
  });

  it('una lista de varias noches: su vigencia sigue incluyendo las noches en que entró gente', async () => {
    await sembrar(consultar, CLAVE, SABADO);
    const actor = await admin();
    await listas.guardarLista(actor, {
      id: null,
      nombre: 'Bailarines de temporada',
      responsable: 'Javiera Soto',
      gratis: true,
      desde: DOMINGO,
      hasta: OTRO_SABADO,
    });
    const temporada = await idDeLista('Bailarines de temporada');
    await listas.pegarIntegrantes(actor, temporada, `${MARTINA} Martina Herrera`);

    // El sábado todavía no vale; el domingo, sí.
    await noches.abrir(actor, SABADO, 0);
    expect((await buscar(await guardia(SABADO), MARTINA)).invitacion).toMatchObject({
      lista: 'Bailarines',
    });
    await cerrar(SABADO, 0);
    await noches.abrir(actor, DOMINGO, 0);
    const puerta = await guardia(DOMINGO);
    expect((await buscar(puerta, MARTINA)).invitacion).toMatchObject({
      lista: 'Bailarines de temporada',
      gratis: true,
    });
    await registrar(puerta, entrada(MARTINA, 'gratis'));
    expect(await listaDeLaEntrada(DOMINGO, MARTINA)).toBe(temporada);

    const cambiar = (desde: string, hasta: string | null) =>
      listas.guardarLista(actor, {
        id: temporada,
        nombre: 'Bailarines de temporada',
        responsable: 'Javiera Soto',
        gratis: true,
        desde,
        hasta,
      });
    // No puede dejar fuera la noche en que alguien entró con ella.
    await expect(cambiar(OTRO_SABADO, OTRO_SABADO)).rejects.toThrow(
      'El domingo, 8 de noviembre entró gente con esta lista: su vigencia debe incluir esa noche',
    );
    // Tampoco empezar antes, en una noche que ya pasó.
    await expect(cambiar(SABADO, OTRO_SABADO)).rejects.toThrow(
      'Una lista no puede empezar en una noche que ya pasó',
    );
    // Sí alargarla o dejarla sin término.
    await cambiar(DOMINGO, '2026-12-31');
    await cambiar(DOMINGO, null);
    // Alguien entró con ella esta misma noche: sigue vigente hasta el cierre.
    await expect(listas.quitarLista(actor, temporada)).rejects.toThrow(
      'Una persona ya entró con esta lista esta noche: queda como registro de cómo entraron',
    );
  });

  it('una lista que nadie usó se elimina con sus personas, y la de una noche se va con su noche', async () => {
    await sembrar(consultar, CLAVE, SABADO);
    const actor = await admin();
    for (const [nombre, hasta] of [
      ['Despedida de soltera', OTRO_SABADO],
      ['Promotores de diciembre', '2026-12-31'],
    ] as const) {
      await listas.guardarLista(actor, {
        id: null,
        nombre,
        responsable: 'Carolina Pinto',
        gratis: false,
        desde: OTRO_SABADO,
        hasta,
      });
    }
    const promotores = await idDeLista('Promotores de diciembre');
    await listas.agregarIntegrante(actor, {
      listaId: promotores,
      documento: MARTINA,
      nombre: 'Martina',
      apellido: 'Herrera',
    });
    expect((await listas.pantallaListas(actor)).listas.map((l) => [l.nombre, l.hasta])).toEqual([
      ['Clientes frecuentes', null],
      ['Bailarines', SABADO],
      ['Cumpleaños de Camila', SABADO],
      ['Despedida de soltera', OTRO_SABADO],
      ['Promotores de diciembre', '2026-12-31'],
    ]);

    // La noche del 14 se cancela: su lista de esa sola noche se va con ella; la de varias, no.
    await noches.eliminar(actor, OTRO_SABADO);
    const quedan = await consultar<{ nombre: string }[]>`
      select nombre from gesnoc.lista where desde = ${OTRO_SABADO}`;
    expect(quedan.map((l) => l.nombre)).toEqual(['Promotores de diciembre']);

    await listas.quitarLista(actor, promotores);
    expect(await consultar`select 1 from gesnoc.lista where id = ${promotores}`).toHaveLength(0);
    expect(
      await consultar`select 1 from gesnoc.integrante where lista_id = ${promotores}`,
    ).toHaveLength(0);
  });

  it('una persona puede estar en varias listas, pero no dos veces en la misma', async () => {
    await sembrar(consultar, CLAVE, SABADO);
    const actor = await admin();
    const persona = { documento: CAMILA, nombre: 'Camila', apellido: 'Rojas' };
    await listas.agregarIntegrante(actor, {
      listaId: await idDeLista('Clientes frecuentes'),
      ...persona,
    });
    await expect(
      listas.agregarIntegrante(actor, {
        listaId: await idDeLista('Cumpleaños de Camila'),
        ...persona,
      }),
    ).rejects.toThrow('Esa persona ya está en la lista');
    await expect(listas.agregarIntegrante(actor, { listaId: 999_999, ...persona })).rejects.toThrow(
      'Esa lista ya no existe',
    );
  });

  it('al cerrar, las listas que terminaron hace más de 12 meses se borran; la sin término sigue (RN-25)', async () => {
    await sembrar(consultar, CLAVE, SABADO);
    const guardiaId = await personaId('guardia');
    // Hace un año: un cumpleaños con el que entró Rodrigo, y amigos de la casa sin término.
    await consultar`
      insert into gesnoc.noche (fecha, precio_entrada, abierta_en, cerrada_en)
      values ('2025-11-01', 5000, '2025-11-01 22:00-03', '2025-11-02 05:00-03')`;
    const [antigua] = await consultar<{ id: number }[]>`
      insert into gesnoc.lista (nombre, responsable, gratis, desde, hasta)
      values ('Cumpleaños de hace un año', 'Rodrigo Antiguo', false, '2025-11-01', '2025-11-01')
      returning id`;
    const [reciente] = await consultar<{ id: number }[]>`
      insert into gesnoc.lista (nombre, responsable, gratis, desde, hasta)
      values ('Cumpleaños de diciembre', 'Valentina Reciente', false, '2025-12-12', '2025-12-12')
      returning id`;
    const [amigos] = await consultar<{ id: number }[]>`
      insert into gesnoc.lista (nombre, responsable, gratis, desde, hasta)
      values ('Amigos de la casa', 'Carla Muñoz', true, '2025-01-01', null) returning id`;
    for (const [lista, documento] of [
      [antigua!.id, '11111112-0'],
      [reciente!.id, '12222223-0'],
      [amigos!.id, '13333334-0'],
    ] as const) {
      await consultar`
        insert into gesnoc.integrante (lista_id, documento, nombre, apellido)
        values (${lista}, ${documento}, 'Persona', 'De Lista')`;
    }
    const [rodrigo] = await consultar<{ id: number }[]>`
      insert into gesnoc.cliente (documento, nombre, apellido)
      values ('11111112-0', 'Rodrigo', 'Antiguo') returning id`;
    await consultar`
      insert into gesnoc.entrada (fecha, cliente_id, monto, medio_pago, ticket, registrada_por, lista_id)
      values ('2025-11-01', ${rodrigo!.id}, 5000, 'efectivo', 1, ${guardiaId}, ${antigua!.id})`;

    await noches.abrir(await admin(), SABADO, 0);
    await cerrar(SABADO, 0);

    const restantes = await consultar<{ nombre: string }[]>`
      select nombre from gesnoc.lista where id in ${consultar([antigua!.id, reciente!.id, amigos!.id])}
      order by nombre`;
    expect(restantes.map((l) => l.nombre)).toEqual([
      'Amigos de la casa',
      'Cumpleaños de diciembre',
    ]);
    expect(
      await consultar`select 1 from gesnoc.integrante where lista_id = ${antigua!.id}`,
    ).toHaveLength(0);
    // La entrada sigue (es historia de la puerta), sin el vínculo, aunque la aplicación no puede
    // modificar una entrada: la clave foránea lo anula con los permisos del dueño de la tabla.
    const [suya] = await consultar<{ lista_id: number | null; monto: number }[]>`
      select lista_id, monto from gesnoc.entrada where fecha = '2025-11-01'`;
    expect(suya).toEqual({ lista_id: null, monto: 5000 });
  });

  it('si la administración quita una lista mientras alguien entra con ella, ninguna de las dos queda a medias', async () => {
    await sembrar(consultar, CLAVE, SABADO);
    await noches.abrir(await admin(), SABADO, 0);
    const puerta = await guardia(SABADO);
    const actor = await admin();
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const documento = `${30_000_000 + vuelta}`;
      const rut = `${documento}-${digitoVerificador(documento)}`;
      const [lista] = await consultar<{ id: number }[]>`
        insert into gesnoc.lista (nombre, responsable, gratis, desde, hasta)
        values (${`Grupo ${vuelta}`}, 'Alguien', true, ${SABADO}, ${SABADO}) returning id`;
      await consultar`
        insert into gesnoc.integrante (lista_id, documento, nombre, apellido)
        values (${lista!.id}, ${rut}, 'Persona', 'Del Grupo')`;

      const [ingreso, quitada] = await Promise.allSettled([
        registrar(puerta, entrada(rut, 'gratis')),
        listas.quitarLista(actor, lista!.id),
      ]);
      // La puerta nunca falla por la lista que se quitaba.
      expect(ingreso.status).toBe('fulfilled');
      const vinculo = await listaDeLaEntrada(SABADO, rut);
      if (quitada.status === 'fulfilled') {
        // Se quitó antes: la persona entró sin lista.
        expect(vinculo).toBeNull();
        expect(await consultar`select 1 from gesnoc.lista where id = ${lista!.id}`).toHaveLength(0);
      } else {
        // Entró antes: la lista queda como registro de cómo entró.
        expect(String(quitada.reason)).toMatch('ya entró con esta lista esta noche');
        expect(vinculo).toBe(lista!.id);
      }
    }
  });
});
