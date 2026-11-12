import { describe, expect, it } from 'vitest';
import * as detalles from '@/modules/noche/servicios/detalles';
import { calendarioDelMes } from '@/modules/noche/servicios/noches';
import { ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { sembrar } from '../../db/seeds/demostracion';
import { administracion, CLAVE, conBaseVacia, consultar, conTurno } from './apoyo';

conBaseVacia();

// El local de demostración con «hoy» el sábado 7 de noviembre: esa noche trae un premio por
// ambiente, dos eventos, un cumpleaños que paga, bailarines que entran gratis y dos invitados.
const hoy = '2026-11-07';
const cerrada = '2026-10-24';

const detalle = async (fecha = hoy) => (await detalles.detalleDeNoche(administracion, fecha))!;
const idDe = async (tabla: 'ambiente' | 'producto', nombre: string) => {
  const [fila] = await consultar<{ id: number }[]>`
    select id from ${consultar('gesnoc')}.${consultar(tabla)} where nombre = ${nombre}`;
  return fila!.id;
};

describe('detalles de la noche (pedido del Product Owner, 12 nov)', () => {
  it('reúne premio, eventos en orden de la noche, listas con sus personas e invitados', async () => {
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
    expect(noche.listas.map((l) => [l.nombre, l.gratis, l.personas.length])).toEqual([
      ['Cumpleaños de Camila', false, 3],
      ['Bailarines', true, 2],
    ]);
    expect(noche.invitados.map((i) => [i.nombre, i.invitadoPor, i.gratis])).toEqual([
      ['Felipe', 'DJ de la noche', true],
      ['Marcela', 'Administración', true],
    ]);
  });

  it('el calendario resume los detalles de cada noche', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const { noches } = await calendarioDelMes(administracion, '2026-11');
    expect(noches[hoy]?.detalles).toMatchObject({
      premios: ['Salón: 1 × Botella de ron añejo', 'Terraza: 1 × Botella de pisco 35°'],
      eventos: [
        { nombre: 'Show de baile', hora: '01:00' },
        { nombre: 'Robot de shots', hora: '02:30' },
      ],
      listas: 2,
      enListas: 5,
      invitados: 2,
    });
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

  it('una persona se invita una sola vez por noche, sea en una lista o individual', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const felipe = {
      fecha: hoy,
      documento: '16543210-K',
      nombre: 'Felipe',
      apellido: 'Araya',
      listaNumero: 1,
      invitadoPor: null,
      gratis: null,
    };
    await expect(detalles.invitar(administracion, felipe)).rejects.toThrow(
      'Esa persona ya está invitada esta noche',
    );
    // Otra noche sí puede venir.
    await detalles.invitar(administracion, {
      ...felipe,
      fecha: '2026-11-14',
      listaNumero: null,
      invitadoPor: 'DJ',
      gratis: true,
    });
  });

  it('la lista pegada entra completa o no entra: dice qué línea corregir', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const contar = async () => (await detalle()).listas[0]!.personas.length;

    await expect(
      detalles.pegarLista(administracion, hoy, 1, '22.446.688-9 Rosa Mena\n13579246-1 Mal Escrito'),
    ).rejects.toThrow('Línea 2: falta un RUT válido');
    await expect(
      detalles.pegarLista(
        administracion,
        hoy,
        1,
        '22.446.688-9 Rosa Mena\n16543210-K Felipe Araya',
      ),
    ).rejects.toThrow('Ya están invitados esta noche: 16.543.210-K');
    expect(await contar()).toBe(3);

    const agregadas = await detalles.pegarLista(
      administracion,
      hoy,
      1,
      '22.446.688-9 Rosa Mena\nTomás Ruiz, 13579246-2',
    );
    expect(agregadas).toBe(2);
    expect(await contar()).toBe(5);
  });

  it('al eliminar una lista se van sus personas; los invitados individuales quedan', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await detalles.guardarLista(administracion, {
      fecha: hoy,
      numero: 2,
      nombre: 'Bailarines del show',
      responsable: 'Javiera Soto',
      gratis: true,
    });
    expect((await detalle()).listas[1]?.nombre).toBe('Bailarines del show');
    await detalles.quitarLista(administracion, hoy, 2);
    const noche = await detalle();
    expect(noche.listas.map((l) => l.nombre)).toEqual(['Cumpleaños de Camila']);
    expect(noche.invitados).toHaveLength(2);
  });

  it('dos listas de la noche no se llaman igual', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await expect(
      detalles.guardarLista(administracion, {
        fecha: hoy,
        numero: null,
        nombre: 'BAILARINES',
        responsable: 'Otra persona',
        gratis: true,
      }),
    ).rejects.toThrow('Ya hay una lista con ese nombre esta noche');
  });

  it('una noche cerrada no admite cambios (RN-26)', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await expect(
      detalles.agregarEvento(administracion, cerrada, 'Show tardío', null),
    ).rejects.toThrow(ErrorDeNegocio);
    await expect(
      detalles.guardarLista(administracion, {
        fecha: cerrada,
        numero: null,
        nombre: 'Tarde',
        responsable: 'Alguien',
        gratis: false,
      }),
    ).rejects.toThrow('Una noche cerrada no admite cambios');
  });

  it('solo la administración prepara la noche (RNF-01)', async () => {
    await sembrar(consultar, CLAVE, hoy);
    for (const actor of [conTurno('guardia'), conTurno('garzon')]) {
      await expect(detalles.detalleDeNoche(actor, hoy)).rejects.toThrow(NoAutorizado);
      await expect(detalles.agregarEvento(actor, hoy, 'Show', null)).rejects.toThrow(NoAutorizado);
    }
  });
});
