import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as detalles from '@/modules/noche/servicios/detalles';
import * as listas from '@/modules/noche/servicios/listas';
import { calendarioDelMes } from '@/modules/noche/servicios/noches';
import { ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { sembrar } from '../../db/seeds/demostracion';
import {
  administracion,
  CLAVE,
  conBaseVacia,
  consultar,
  conTurno,
  fijarReloj,
  relojReal,
} from './apoyo';

conBaseVacia();

// El local de demostración con «hoy» el sábado 7 de noviembre: esa noche trae un premio por
// ambiente, dos eventos, un cumpleaños que paga, bailarines que entran gratis y dos invitados, y la
// lista sin término de los clientes frecuentes vale desde dos semanas antes.
const hoy = '2026-11-07';
const cerrada = '2026-10-24';
beforeAll(() => fijarReloj(hoy));
afterAll(relojReal);

const detalle = async (fecha = hoy) => (await detalles.detalleDeNoche(administracion, fecha))!;
const listaLlamada = async (nombre: string) =>
  (await detalle()).listas.find((lista) => lista.nombre === nombre)!;
const idDe = async (tabla: 'ambiente' | 'producto', nombre: string) => {
  const [fila] = await consultar<{ id: number }[]>`
    select id from ${consultar('gesnoc')}.${consultar(tabla)} where nombre = ${nombre}`;
  return fila!.id;
};

describe('detalles de la noche (pedido del Product Owner, 12 nov)', () => {
  it('reúne premio, eventos en orden de la noche, listas vigentes con sus personas e invitados', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await detalles.agregarEvento(administracion, hoy, 'Banda en vivo', '23:30');
    const noche = await detalle();

    expect(noche.premios.map((p) => [p.ambiente, p.cantidad, p.producto])).toEqual([
      ['Salón', 1, 'Botella de ron añejo'],
      ['Terraza', 1, 'Botella de pisco 35°'],
    ]);
    // Lo de después de medianoche va después de lo de antes.
    expect(noche.eventos.map((e) => [e.hora, e.nombre])).toEqual([
      ['23:30', 'Banda en vivo'],
      ['01:00', 'Show de baile'],
      ['02:30', 'Robot de shots'],
    ]);
    // Primero las de esta sola noche; al final, la que no tiene término.
    expect(
      noche.listas.map((l) => [l.nombre, l.gratis, l.personas.length, l.desde, l.hasta]),
    ).toEqual([
      ['Bailarines', true, 2, hoy, hoy],
      ['Cumpleaños de Camila', false, 3, hoy, hoy],
      ['Clientes frecuentes', true, 3, '2026-10-24', null],
    ]);
    expect(noche.listas.every((l) => l.editable)).toBe(true);
    expect(noche.invitados.map((i) => [i.nombre, i.invitadoPor, i.gratis])).toEqual([
      ['Felipe', 'DJ de la noche', true],
      ['Marcela', 'Administración', true],
    ]);
  });

  it('el calendario resume los detalles de cada noche, con las listas vigentes en ella', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const { noches } = await calendarioDelMes(administracion, '2026-11');
    expect(noches[hoy]?.detalles).toMatchObject({
      premios: ['Salón: 1 × Botella de ron añejo', 'Terraza: 1 × Botella de pisco 35°'],
      eventos: [
        { nombre: 'Show de baile', hora: '01:00' },
        { nombre: 'Robot de shots', hora: '02:30' },
      ],
      listas: 3,
      enListas: 8,
      invitados: 2,
    });
    // La noche siguiente solo tiene la de los clientes frecuentes.
    expect(noches['2026-11-08']?.detalles).toMatchObject({ listas: 1, enListas: 3, invitados: 0 });
  });

  it('el premio de un ambiente se reemplaza completo, con varias botellas', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const salon = await idDe('ambiente', 'Salón');
    const vodka = await idDe('producto', 'Botella de vodka');
    const espumante = await idDe('producto', 'Botella de espumante');
    await detalles.elegirPremio(administracion, {
      fecha: hoy,
      ambienteId: salon,
      items: [
        { productoId: vodka, cantidad: 2 },
        { productoId: espumante, cantidad: 1 },
      ],
    });
    const { premios } = await detalle();
    expect(
      premios.filter((p) => p.ambiente === 'Salón').map((p) => [p.producto, p.cantidad]),
    ).toEqual([
      ['Botella de espumante', 1],
      ['Botella de vodka', 2],
    ]);
    await detalles.elegirPremio(administracion, { fecha: hoy, ambienteId: salon, items: [] });
    expect((await detalle()).premios.map((p) => p.ambiente)).toEqual(['Terraza']);
  });

  it('una persona se invita una sola vez por noche; otra noche puede volver', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const felipe = {
      fecha: hoy,
      documento: '16543210-K',
      nombre: 'Felipe',
      apellido: 'Araya',
      invitadoPor: 'Administración',
      gratis: true,
    };
    await expect(detalles.invitar(administracion, felipe)).rejects.toThrow(
      'Esa persona ya está invitada esta noche',
    );
    await detalles.invitar(administracion, { ...felipe, fecha: '2026-11-14', invitadoPor: 'DJ' });
  });

  it('la lista pegada entra completa o no entra: dice qué línea corregir', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const cumpleanos = (await listaLlamada('Cumpleaños de Camila')).id;
    const contar = async () => (await listaLlamada('Cumpleaños de Camila')).personas.length;

    await expect(
      listas.pegarIntegrantes(
        administracion,
        cumpleanos,
        '22.446.688-9 Rosa Mena\n13579246-1 Mal Escrito',
      ),
    ).rejects.toThrow('Línea 2: falta un RUT válido');
    await expect(
      listas.pegarIntegrantes(
        administracion,
        cumpleanos,
        '22.446.688-9 Rosa Mena\n15678234-3 Camila Rojas',
      ),
    ).rejects.toThrow('Ya están en la lista: 15.678.234-3');
    expect(await contar()).toBe(3);

    // Felipe viene invitado por el DJ, pero también puede estar en la lista del cumpleaños.
    const agregadas = await listas.pegarIntegrantes(
      administracion,
      cumpleanos,
      '22.446.688-9 Rosa Mena\nTomás Ruiz, 13579246-2\n16543210-K Felipe Araya',
    );
    expect(agregadas).toBe(3);
    expect(await contar()).toBe(6);
  });

  it('al eliminar una lista sin uso se van sus personas; los invitados individuales quedan', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const bailarines = await listaLlamada('Bailarines');
    await listas.guardarLista(administracion, {
      id: bailarines.id,
      nombre: 'Bailarines del show',
      responsable: 'Javiera Soto',
      gratis: true,
      desde: hoy,
      hasta: hoy,
    });
    expect((await detalle()).listas[0]?.nombre).toBe('Bailarines del show');
    await listas.quitarLista(administracion, bailarines.id);
    const noche = await detalle();
    expect(noche.listas.map((l) => l.nombre)).toEqual([
      'Cumpleaños de Camila',
      'Clientes frecuentes',
    ]);
    expect(noche.invitados).toHaveLength(2);
    expect(
      await consultar`select 1 from gesnoc.integrante where lista_id = ${bailarines.id}`,
    ).toHaveLength(0);
  });

  it('dos listas que comparten una noche no se llaman igual', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await expect(
      listas.guardarLista(administracion, {
        id: null,
        nombre: 'BAILARINES',
        responsable: 'Otra persona',
        gratis: true,
        desde: hoy,
        hasta: hoy,
      }),
    ).rejects.toThrow('Ya hay una lista «BAILARINES» en esas noches');
    // La de los clientes frecuentes vale todas las noches: ninguna otra se llama igual.
    await expect(
      listas.guardarLista(administracion, {
        id: null,
        nombre: 'clientes frecuentes',
        responsable: 'Otra persona',
        gratis: true,
        desde: '2026-12-24',
        hasta: '2026-12-24',
      }),
    ).rejects.toThrow('Ya hay una lista «clientes frecuentes» en esas noches');
    // Otra noche, sí.
    await listas.guardarLista(administracion, {
      id: null,
      nombre: 'Bailarines',
      responsable: 'Javiera Soto',
      gratis: true,
      desde: '2026-11-14',
      hasta: '2026-11-14',
    });
  });

  it('una noche cerrada no admite cambios (RN-26)', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await expect(
      detalles.agregarEvento(administracion, cerrada, 'Show tardío', null),
    ).rejects.toThrow(ErrorDeNegocio);
    await expect(
      detalles.invitar(administracion, {
        fecha: cerrada,
        documento: '13579246-2',
        nombre: 'Tomás',
        apellido: 'Ruiz',
        invitadoPor: 'DJ',
        gratis: true,
      }),
    ).rejects.toThrow('Una noche cerrada no admite cambios');
    await expect(
      listas.guardarLista(administracion, {
        id: null,
        nombre: 'Tarde',
        responsable: 'Alguien',
        gratis: false,
        desde: cerrada,
        hasta: cerrada,
      }),
    ).rejects.toThrow('Una lista no puede empezar en una noche que ya pasó');
    // Vista desde la noche cerrada, la lista de los clientes frecuentes es de solo lectura.
    const { listas: deEsaNoche } = await detalle(cerrada);
    expect(deEsaNoche.map((l) => [l.nombre, l.editable])).toEqual([['Clientes frecuentes', false]]);
  });

  it('solo la administración prepara la noche y sus listas (RNF-01)', async () => {
    await sembrar(consultar, CLAVE, hoy);
    for (const actor of [conTurno('guardia'), conTurno('garzon')]) {
      await expect(detalles.detalleDeNoche(actor, hoy)).rejects.toThrow(NoAutorizado);
      await expect(detalles.agregarEvento(actor, hoy, 'Show', null)).rejects.toThrow(NoAutorizado);
      await expect(listas.pantallaListas(actor)).rejects.toThrow(NoAutorizado);
      await expect(listas.quitarLista(actor, 1)).rejects.toThrow(NoAutorizado);
    }
  });
});
