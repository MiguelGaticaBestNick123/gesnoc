import { beforeEach, describe, expect, it } from 'vitest';
import * as detalles from '@/modules/noche/servicios/detalles';
import { datosEntrada } from '@/modules/porteria/esquemas';
import { elegirGanador } from '@/modules/porteria/ganador';
import { registrar } from '@/modules/porteria/servicios/puerta';
import { pantallaSorteo, sortear } from '@/modules/porteria/servicios/sorteo';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia } from './apoyo';
import { fecha, prepararNoche, total, type Local } from './noche-abierta';

conBaseVacia();

let local: Local;
beforeEach(async () => {
  local = await prepararNoche();
});

const guardia = () => local.persona('guardia');
const primero = () => 0;

const entrar = (documento: string, forma: 'efectivo' | 'tarjeta' | 'pendiente' | 'gratis') =>
  registrar(
    guardia(),
    datosEntrada.parse({
      tipoDocumento: 'rut',
      documento,
      nombre: 'Cliente',
      apellido: documento.slice(0, 4),
      forma,
      monto: forma === 'gratis' ? 0 : 5000,
    }),
  );

describe('elegir el ganador', () => {
  it('usa la fuente de azar sobre los tickets que participan', () => {
    expect(elegirGanador([3, 5, 9], () => 2)).toBe(9);
    expect(() => elegirGanador([], () => 0)).toThrow('No hay tickets para sortear');
  });
});

describe('HU-37 sorteo del premio de cada ambiente (RN-23)', () => {
  it('participan solo los tickets de la noche y queda el premio, el ganador y el responsable', async () => {
    await entrar('15678234-3', 'efectivo');
    await entrar('19876543-0', 'gratis');
    await entrar('17654321-3', 'pendiente');
    expect((await pantallaSorteo(guardia())).participantes).toBe(2);

    const ganador = await sortear(guardia(), local.salon, () => 1);
    expect(ganador).toMatchObject({
      ticket: 2,
      premio: '1 × Botella de ron añejo',
      documento: '17654321-3',
      repetido: false,
    });
    const pantalla = await pantallaSorteo(guardia());
    expect(pantalla.participantes).toBe(1);
    expect(pantalla.ambientes.find((a) => a.id === local.salon)?.ganador?.ticket).toBe(2);
  });

  it('un reintento devuelve el mismo ganador: no se sortea dos veces', async () => {
    await entrar('15678234-3', 'efectivo');
    await entrar('17654321-3', 'tarjeta');
    const inicial = await sortear(guardia(), local.salon, primero);
    const segundo = await sortear(guardia(), local.salon, () => 1);
    expect(segundo).toMatchObject({ ticket: inicial.ticket, repetido: true });
    expect(await total('sorteo')).toBe(1);
  });

  it('un ticket no gana dos veces: el otro ambiente sortea entre los que quedan', async () => {
    await entrar('15678234-3', 'efectivo');
    await entrar('17654321-3', 'tarjeta');
    expect((await sortear(guardia(), local.salon, primero)).ticket).toBe(1);
    expect((await sortear(guardia(), local.terraza, primero)).ticket).toBe(2);
  });

  it('dos guardias que sortean a la vez el mismo ambiente ven el mismo ganador', async () => {
    for (const rut of ['15678234-3', '17654321-3', '18234567-9', '20123456-5']) {
      await entrar(rut, 'efectivo');
    }
    const resultados = await Promise.all([
      sortear(guardia(), local.salon),
      sortear(local.persona('admin'), local.salon),
    ]);
    expect(new Set(resultados.map((r) => r.ticket)).size).toBe(1);
    expect(resultados.filter((r) => r.repetido)).toHaveLength(1);
  });

  it('sin tickets o sin premio no hay sorteo', async () => {
    await expect(sortear(guardia(), local.salon)).rejects.toThrow('No hay tickets para sortear');
    await entrar('15678234-3', 'efectivo');
    await detalles.elegirPremio(administracion, { fecha, ambienteId: local.terraza, items: [] });
    await expect(sortear(guardia(), local.terraza)).rejects.toThrow(
      'Este ambiente no tiene premio',
    );
  });

  it('después de sortear, el premio de ese ambiente ya no cambia', async () => {
    await entrar('15678234-3', 'efectivo');
    await sortear(guardia(), local.salon, primero);
    await expect(
      detalles.elegirPremio(administracion, { fecha, ambienteId: local.salon, items: [] }),
    ).rejects.toThrow('Ese ambiente ya sorteó su premio esta noche');
    // La página de la noche muestra el ticket ganador en vez de ofrecer cambiar el premio.
    expect((await detalles.detalleDeNoche(administracion, fecha))!.sorteos).toEqual([
      { ambienteId: local.salon, ticket: 1 },
    ]);
  });

  it('solo el guardia y la administración sortean', async () => {
    await entrar('15678234-3', 'efectivo');
    await expect(sortear(local.persona('garzon'), local.salon)).rejects.toThrow(NoAutorizado);
    await expect(pantallaSorteo(local.persona('barra'))).rejects.toThrow(NoAutorizado);
  });
});
