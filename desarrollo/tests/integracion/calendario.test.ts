import { describe, expect, it } from 'vitest';
import { listar as listarPersonal } from '@/modules/acceso/servicios/personal';
import { calendarioDelMes, estado } from '@/modules/noche/servicios/noches';
import { hoyEnChile } from '@/shared/utilidades/fechas';
import { miCalendario, pantallaAsignacion } from '@/modules/noche/servicios/turnos';
import { NoAutorizado } from '@/shared/errores';
import { sembrar } from '../../db/seeds/demostracion';
import { administracion, CLAVE, conBaseVacia, consultar, sinTurno } from './apoyo';

conBaseVacia();

// El local de demostración con «hoy» el sábado 7 de noviembre: tiene noches el 7, el 8 y el 14, y un
// historial de cuatro noches cerradas (24, 25 y 31 de octubre y 1 de noviembre).
const hoy = '2026-11-07';

const idDe = async (correo: string) => {
  const [fila] = await consultar<{ id: number }[]>`
    select id from gesnoc.usuario where correo = ${correo}`;
  return fila!.id;
};

describe('HU-08 calendario de noches de la administración', () => {
  it('cada noche del mes con su estado, quién tiene turno y quién postuló', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const calendario = await calendarioDelMes(administracion, '2026-11');

    expect(Object.keys(calendario.noches)).toEqual([
      '2026-11-01',
      '2026-11-07',
      '2026-11-08',
      '2026-11-14',
    ]);
    expect(calendario.noches['2026-11-01']?.estado).toBe('cerrada');
    expect(calendario.noches['2026-11-07']?.estado).toBe('programada');
    // Quién trabajó la noche cerrada, con su rol y ambiente.
    expect(calendario.noches['2026-11-01']?.turnos).toContainEqual(
      expect.objectContaining({ nombre: 'Lucía Díaz', rol: 'guardia', ambiente: null }),
    );
    expect(calendario.noches['2026-11-07']?.turnos).toHaveLength(6);
    expect(calendario.noches['2026-11-14']?.postulantes.map((p) => p.nombre)).toEqual([
      'Diego Soto',
      'Lucía Díaz',
    ]);
    // Al habilitar un día nuevo se propone el precio de la última noche.
    expect(calendario.precioSugerido).toBe(7000);
  });

  it('solo la administración ve el calendario de todos', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await expect(calendarioDelMes(sinTurno(), '2026-11')).rejects.toThrow(NoAutorizado);
  });
});

describe('HU-09 calendario propio', () => {
  it('pinta las noches en que trabajó y de qué rol, y a cuáles postuló', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const lucia = sinTurno(await idDe('sinturno@gesnoc.test'));

    const octubre = await miCalendario(lucia, '2026-10');
    expect(Object.values(octubre.noches).map((n) => n.rol)).toEqual([
      'guardia',
      'guardia',
      'garzon',
    ]);

    const noviembre = await miCalendario(lucia, '2026-11');
    expect(noviembre.noches['2026-11-01']?.rol).toBe('guardia');
    expect(noviembre.noches['2026-11-14']).toMatchObject({ disponible: true, rol: null });
    expect(noviembre.noches['2026-11-07']).toMatchObject({ disponible: false, rol: null });
  });
});

describe('HU-10 recomendación al asignar', () => {
  it('reconoce el rol habitual de cada persona por su historial', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const { dotacion } = await pantallaAsignacion(administracion, hoy);
    const de = (nombre: string) => dotacion.find((p) => p.nombre === nombre)!;

    expect(de('Bruno Pérez').principal).toBe('guardia');
    // Lucía fue guardia tres veces y garzón una: suele ser guardia aunque hoy no tenga turno.
    expect(de('Lucía Díaz')).toMatchObject({
      principal: 'guardia',
      veces: { guardia: 3, garzon: 1 },
    });
    // Paula rota, pero lo suyo es garzón.
    expect(de('Paula Vera').principal).toBe('garzon');
    expect(de('Rocío Paredes').principal).toBeNull();
  });
});

describe('HU-03 trayectoria en la pantalla de personal', () => {
  it('el rol habitual, las noches trabajadas, la última y el próximo turno salen de los turnos', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const personas = await listarPersonal(administracion);
    const de = (nombre: string) => personas.find((p) => p.nombre === nombre)!;

    // Diego trabajó de garzón las cuatro noches cerradas; la de hoy no se ha abierto.
    expect(de('Diego Soto')).toMatchObject({
      principal: 'garzon',
      noches: 4,
      ultima: '2026-11-01',
      proximo: { fecha: hoy, rol: 'garzon', ambiente: 'Salón' },
    });
    // Quien cocina no lleva ambiente: la cocina es de todo el local.
    expect(de('Inés Castro').proximo).toEqual({ fecha: hoy, rol: 'cocinero', ambiente: null });
    expect(de('Rocío Paredes')).toMatchObject({
      principal: null,
      noches: 0,
      ultima: null,
      proximo: null,
    });
  });
});

describe('HU-11 abrir la noche', () => {
  it('propone la noche de hoy o la próxima; las pasadas sin abrir van al final, marcadas', async () => {
    const hoyReal = hoyEnChile();
    await sembrar(consultar, CLAVE, hoyReal);
    const [hace3] = await consultar<{ fecha: string }[]>`
      insert into gesnoc.noche (fecha, precio_entrada)
      values (${hoyReal}::date - 3, 5000) returning fecha::text`;
    const { programadas } = await estado(administracion);
    expect(programadas[0]).toMatchObject({ fecha: hoyReal, pasada: false });
    expect(programadas.at(-1)).toMatchObject({ fecha: hace3!.fecha, pasada: true });
  });
});
