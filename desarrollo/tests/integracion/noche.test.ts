import { beforeEach, describe, expect, it } from 'vitest';
import type { DatosAsignacion } from '@/modules/noche/esquemas';
import * as noches from '@/modules/noche/servicios/noches';
import * as turnos from '@/modules/noche/servicios/turnos';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar, conTurno, crearPersona, sinTurno } from './apoyo';

conBaseVacia();

const fecha = '2026-11-13';
const otraFecha = '2026-11-14';
const noche = { fecha, nota: 'Entrada gratis hasta las 00:00', precioEntrada: 5000 };

const programar = (dia = fecha) => noches.programar(administracion, { ...noche, fecha: dia });

async function crearAmbiente(nombre = 'Salón') {
  const [fila] = await consultar<{ id: number }[]>`
    insert into gesnoc.ambiente (nombre, plano_ancho, plano_alto)
    values (${nombre}, 900, 400) returning id`;
  return fila!.id;
}

const cerrar = (dia = fecha) =>
  consultar`update gesnoc.noche set cerrada_en = abierta_en + interval '1 hour' where fecha = ${dia}`;

describe('HU-08 programar noches', () => {
  it('CA1: la fecha operativa queda fijada al programar (RN-01)', async () => {
    await programar();
    const [programada] = await noches.listar(administracion);
    expect(programada).toMatchObject({ ...noche, abiertaEn: null, cerradaEn: null });
  });

  it('cuenta la disponibilidad y los turnos de cada noche por separado', async () => {
    const persona = await crearPersona('ana@gesnoc.test');
    await programar();
    await programar(otraFecha);
    await turnos.declararDisponibilidad(sinTurno(persona), fecha, true);
    await turnos.asignar(administracion, {
      fecha,
      usuarioId: persona,
      rol: 'guardia',
      ambienteId: null,
      confirmarSinDisponibilidad: false,
    });

    const [primera, segunda] = await noches.listar(administracion);
    expect(primera).toMatchObject({ disponibles: 1, asignados: 1 });
    expect(segunda).toMatchObject({ disponibles: 0, asignados: 0 });
  });

  it('una fecha no se programa dos veces', async () => {
    await programar();
    await expect(programar()).rejects.toThrow('Esa noche ya está programada');
  });

  it('se edita la nota y el precio, también con la noche abierta', async () => {
    await programar();
    await noches.abrir(administracion, fecha, 0);
    await noches.editar(administracion, { fecha, nota: null, precioEntrada: 3000 });
    const [editada] = await noches.listar(administracion);
    expect(editada).toMatchObject({ nota: null, precioEntrada: 3000 });
  });

  it('una noche cerrada no admite cambios (RN-26)', async () => {
    await programar();
    await noches.abrir(administracion, fecha, 0);
    await cerrar();
    await expect(
      noches.editar(administracion, { fecha, nota: null, precioEntrada: 3000 }),
    ).rejects.toThrow('Una noche cerrada no admite cambios');
  });

  it('una noche sin abrir se elimina con su disponibilidad', async () => {
    const persona = await crearPersona('ana@gesnoc.test');
    await programar();
    await turnos.declararDisponibilidad(sinTurno(persona), fecha, true);
    await noches.eliminar(administracion, fecha);
    expect(await noches.listar(administracion)).toEqual([]);
  });

  it('una noche que ya se abrió no se elimina', async () => {
    await programar();
    await noches.abrir(administracion, fecha, 0);
    await expect(noches.eliminar(administracion, fecha)).rejects.toThrow(
      'Solo se puede eliminar una noche que aún no se abre',
    );
  });

  it('solo la administración programa noches (RNF-01)', async () => {
    await expect(noches.programar(conTurno('garzon'), noche)).rejects.toThrow(NoAutorizado);
  });
});

describe('HU-09 mis turnos y disponibilidad', () => {
  let actor: ReturnType<typeof sinTurno>;

  beforeEach(async () => {
    actor = sinTurno(await crearPersona('ana@gesnoc.test'));
  });

  it('CA1: declara y retira su disponibilidad en una noche programada', async () => {
    await programar();
    await turnos.declararDisponibilidad(actor, fecha, true);
    expect((await turnos.misTurnos(actor))[0]).toMatchObject({ fecha, disponible: true });

    await turnos.declararDisponibilidad(actor, fecha, false);
    expect((await turnos.misTurnos(actor))[0]).toMatchObject({ disponible: false });
  });

  it('declarar dos veces no duplica ni falla', async () => {
    await programar();
    await turnos.declararDisponibilidad(actor, fecha, true);
    await turnos.declararDisponibilidad(actor, fecha, true);
    const [fila] = await consultar<{ total: number }[]>`
      select count(*)::int as total from gesnoc.disponibilidad`;
    expect(fila!.total).toBe(1);
  });

  it('CA1: no se declara en una noche que no existe (RN-03)', async () => {
    await expect(turnos.declararDisponibilidad(actor, fecha, true)).rejects.toThrow(
      'Solo puedes declararte disponible en noches programadas',
    );
  });

  it('CA1: no se declara en una noche ya abierta (RN-03)', async () => {
    await programar();
    await noches.abrir(administracion, fecha, 0);
    await expect(turnos.declararDisponibilidad(actor, fecha, true)).rejects.toThrow(
      'Solo puedes declararte disponible en noches programadas',
    );
  });

  it('CA2: ve el rol y el ambiente de cada turno', async () => {
    const ambienteId = await crearAmbiente();
    await programar();
    await turnos.asignar(administracion, {
      fecha,
      usuarioId: actor.id,
      rol: 'garzon',
      ambienteId,
      confirmarSinDisponibilidad: true,
    });
    expect((await turnos.misTurnos(actor))[0]).toMatchObject({ rol: 'garzon', ambiente: 'Salón' });
  });

  it('cada persona ve solo lo suyo', async () => {
    const otra = sinTurno(await crearPersona('otra@gesnoc.test'));
    await programar();
    await turnos.declararDisponibilidad(otra, fecha, true);
    expect((await turnos.misTurnos(actor))[0]).toMatchObject({ disponible: false });
  });

  it('una noche cerrada sale del calendario', async () => {
    await programar();
    await noches.abrir(administracion, fecha, 0);
    await cerrar();
    expect(await turnos.misTurnos(actor)).toEqual([]);
  });
});

describe('HU-10 asignar turnos', () => {
  let usuarioId: number;
  let ambienteId: number;
  let turno: DatosAsignacion;

  beforeEach(async () => {
    usuarioId = await crearPersona('ana@gesnoc.test');
    ambienteId = await crearAmbiente();
    await programar();
    turno = { fecha, usuarioId, rol: 'garzon', ambienteId, confirmarSinDisponibilidad: false };
  });

  const dotacion = async () => (await turnos.pantallaAsignacion(administracion, fecha)).dotacion;

  it('CA2: advierte si la persona no declaró disponibilidad', async () => {
    await expect(turnos.asignar(administracion, turno)).rejects.toThrow(
      'no declaró disponibilidad',
    );
    expect((await dotacion())[0]).toMatchObject({ rol: null, disponible: false });
  });

  it('CA2: con la confirmación asigna de todos modos', async () => {
    await turnos.asignar(administracion, { ...turno, confirmarSinDisponibilidad: true });
    expect((await dotacion())[0]).toMatchObject({ rol: 'garzon', ambienteId });
  });

  it('quien declaró disponibilidad se asigna sin confirmar', async () => {
    await turnos.declararDisponibilidad(sinTurno(usuarioId), fecha, true);
    await turnos.asignar(administracion, turno);
    expect((await dotacion())[0]).toMatchObject({ rol: 'garzon', disponible: true });
  });

  it('CA1: una persona tiene a lo más un turno por noche: reasignar reemplaza (RN-04)', async () => {
    await turnos.declararDisponibilidad(sinTurno(usuarioId), fecha, true);
    const terraza = await crearAmbiente('Terraza');
    await turnos.asignar(administracion, turno);
    await turnos.asignar(administracion, { ...turno, rol: 'barman', ambienteId: terraza });

    const [fila] = await consultar<{ total: number }[]>`
      select count(*)::int as total from gesnoc.asignacion`;
    expect(fila!.total).toBe(1);
    expect((await dotacion())[0]).toMatchObject({ rol: 'barman', ambienteId: terraza });
  });

  it('CA1: la base rechaza un guardia con ambiente y un garzón sin él (RN-04)', async () => {
    const confirmado = { ...turno, confirmarSinDisponibilidad: true };
    const mensaje = 'El guardia no lleva ambiente y los demás roles sí';
    await expect(turnos.asignar(administracion, { ...confirmado, rol: 'guardia' })).rejects.toThrow(
      mensaje,
    );
    await expect(
      turnos.asignar(administracion, { ...confirmado, ambienteId: null }),
    ).rejects.toThrow(mensaje);
  });

  it('un guardia se asigna sin ambiente', async () => {
    await turnos.asignar(administracion, {
      ...turno,
      rol: 'guardia',
      ambienteId: null,
      confirmarSinDisponibilidad: true,
    });
    expect((await dotacion())[0]).toMatchObject({ rol: 'guardia', ambienteId: null });
  });

  it('un turno se puede quitar', async () => {
    await turnos.asignar(administracion, { ...turno, confirmarSinDisponibilidad: true });
    await turnos.quitar(administracion, fecha, usuarioId);
    expect((await dotacion())[0]).toMatchObject({ rol: null });
  });

  it('una noche cerrada no admite turnos (RN-26)', async () => {
    await noches.abrir(administracion, fecha, 0);
    await cerrar();
    await expect(
      turnos.asignar(administracion, { ...turno, confirmarSinDisponibilidad: true }),
    ).rejects.toThrow('Una noche cerrada no admite cambios');
    await expect(turnos.quitar(administracion, fecha, usuarioId)).rejects.toThrow(
      'Una noche cerrada no admite cambios',
    );
  });

  it('las cuentas desactivadas no aparecen en la dotación', async () => {
    await consultar`update gesnoc.usuario set activo = false where id = ${usuarioId}`;
    expect(await dotacion()).toEqual([]);
  });

  it('solo la administración asigna turnos (RNF-01)', async () => {
    await expect(turnos.asignar(conTurno('garzon'), turno)).rejects.toThrow(NoAutorizado);
  });
});

describe('HU-11 abrir la noche', () => {
  it('registra la apertura y el fondo de caja en una sola operación', async () => {
    await programar();
    await noches.abrir(administracion, fecha, 50000);

    const { abierta, programadas } = await noches.estado(administracion);
    expect(abierta).toMatchObject({ fecha, fondoInicial: 50000 });
    expect(programadas).toEqual([]);
  });

  it('CA1: solo puede haber una noche abierta (RN-02)', async () => {
    await programar();
    await programar(otraFecha);
    await noches.abrir(administracion, fecha, 0);
    await expect(noches.abrir(administracion, otraFecha, 0)).rejects.toThrow(
      'Ya hay una noche abierta',
    );
    expect((await noches.estado(administracion)).abierta?.fecha).toBe(fecha);
  });

  it('al fallar no deja un arqueo huérfano', async () => {
    await programar();
    await programar(otraFecha);
    await noches.abrir(administracion, fecha, 0);
    await noches.abrir(administracion, otraFecha, 0).catch(() => {});
    const [fila] = await consultar<{ total: number }[]>`
      select count(*)::int as total from gesnoc.arqueo`;
    expect(fila!.total).toBe(1);
  });

  it('dos aperturas simultáneas dejan una sola noche abierta (RN-02)', async () => {
    await programar();
    await programar(otraFecha);
    const resultados = await Promise.allSettled([
      noches.abrir(administracion, fecha, 0),
      noches.abrir(administracion, otraFecha, 0),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('una noche que no existe o ya se abrió no se puede abrir', async () => {
    await expect(noches.abrir(administracion, fecha, 0)).rejects.toThrow('no existe o ya fue');
    await programar();
    await noches.abrir(administracion, fecha, 0);
    await expect(noches.abrir(administracion, fecha, 0)).rejects.toThrow('no existe o ya fue');
  });

  it('una noche cerrada no se vuelve a abrir (RN-26)', async () => {
    await programar();
    await noches.abrir(administracion, fecha, 0);
    await cerrar();
    await expect(noches.abrir(administracion, fecha, 0)).rejects.toThrow('no existe o ya fue');
  });

  it('CA2: la base no acepta un fondo negativo (RN-24)', async () => {
    await programar();
    await expect(noches.abrir(administracion, fecha, -1)).rejects.toThrow();
    expect((await noches.estado(administracion)).abierta).toBeUndefined();
  });

  it('solo la administración abre la noche (RNF-01)', async () => {
    await programar();
    await expect(noches.abrir(conTurno('garzon'), fecha, 0)).rejects.toThrow(NoAutorizado);
  });
});
