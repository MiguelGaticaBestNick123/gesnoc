import { beforeEach, describe, expect, it } from 'vitest';
import { datosEntrada, datosReporte, type DatosReporte } from '@/modules/porteria/esquemas';
import { historial, reportar } from '@/modules/porteria/servicios/clientes';
import { buscar, registrar } from '@/modules/porteria/servicios/puerta';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar } from './apoyo';
import { fecha, prepararNoche, total, type Local } from './noche-abierta';

conBaseVacia();

const RUT = '12345678-5';

const reporte = (tipo: DatosReporte['tipo'], descripcion: string, documento = RUT) =>
  datosReporte.parse({ tipoDocumento: 'rut', documento, tipo, descripcion });

describe('HU-35 y HU-36 con la noche abierta', () => {
  let local: Local;
  const guardia = () => local.persona('guardia');

  beforeEach(async () => {
    local = await prepararNoche();
    await registrar(
      guardia(),
      datosEntrada.parse({
        tipoDocumento: 'rut',
        documento: RUT,
        nombre: 'Iván',
        apellido: 'Mora',
        forma: 'gratis',
        monto: 0,
      }),
    );
  });

  it('HU-35 CA1 (RN-30): el reporte guarda tipo, descripción, autor, noche y hora', async () => {
    expect(await reportar(guardia(), reporte('advertencia', 'Discutió con el barman'))).toEqual({
      numero: 1,
    });
    const [fila] = await consultar<
      { numero: number; fecha: string; tipo: string; descripcion: string; registrado_por: number }[]
    >`select numero, fecha::text as fecha, tipo, descripcion, registrado_por from gesnoc.reporte`;
    expect(fila).toEqual({
      numero: 1,
      fecha,
      tipo: 'advertencia',
      descripcion: 'Discutió con el barman',
      registrado_por: guardia().id,
    });
  });

  it('el número es correlativo por cliente, también con dos reportes a la vez', async () => {
    await Promise.all([
      reportar(guardia(), reporte('observacion', 'Llegó con un grupo grande')),
      reportar(local.persona('admin'), reporte('advertencia', 'Volvió a discutir')),
    ]);
    await reportar(guardia(), reporte('expulsion', 'Comenzó a buscar pelea'));
    const numeros = await consultar<{ numero: number }[]>`
      select numero from gesnoc.reporte order by numero`;
    expect(numeros.map((f) => f.numero)).toEqual([1, 2, 3]);
  });

  it('HU-36 CA1: el historial trae las visitas y los reportes, del más reciente al más antiguo', async () => {
    await reportar(guardia(), reporte('advertencia', 'Primera vez'));
    await reportar(guardia(), reporte('expulsion', 'Segunda vez'));
    const datos = await historial(guardia(), RUT);

    expect(datos.cliente).toEqual({ nombre: 'Iván', apellido: 'Mora' });
    expect(datos.nocheAbierta).toBe(true);
    expect(datos.visitas).toEqual([
      expect.objectContaining({ fecha, ticket: null, forma: 'gratis' }),
    ]);
    expect(datos.reportes.map((r) => [r.numero, r.tipo, r.autor])).toEqual([
      [2, 'expulsion', 'Bruno Pérez'],
      [1, 'advertencia', 'Bruno Pérez'],
    ]);
  });

  it('HU-36 CA2: al buscarlo en la puerta aparece el resumen de sus reportes', async () => {
    expect((await buscar(guardia(), RUT)).cliente?.reportes).toEqual({
      total: 0,
      ultimo: null,
      expulsado: false,
    });
    await reportar(guardia(), reporte('expulsion', 'Comenzó a buscar pelea'));
    await reportar(guardia(), reporte('observacion', 'Pidió hablar con la administración'));

    const resumen = (await buscar(guardia(), RUT)).cliente?.reportes;
    expect(resumen).toMatchObject({ total: 2, expulsado: true });
    expect(resumen?.ultimo).toMatchObject({ tipo: 'observacion', numero: 2 });
  });

  it('un documento sin registro tiene historial vacío y no se puede reportar', async () => {
    const otro = '11111111-1';
    expect(await historial(guardia(), otro)).toMatchObject({ cliente: null, reportes: [] });
    await expect(reportar(guardia(), reporte('advertencia', 'Sin registro', otro))).rejects.toThrow(
      'solo se reporta a quien pasó por la puerta',
    );
    expect(await total('reporte')).toBe(0);
  });

  it('HU-35 CA3 (RN-25): solo el guardia y la administración ven o crean reportes', async () => {
    for (const persona of ['garzon', 'barra', 'cocina']) {
      await expect(historial(local.persona(persona), RUT)).rejects.toThrow(NoAutorizado);
      await expect(
        reportar(local.persona(persona), reporte('advertencia', 'No debería quedar')),
      ).rejects.toThrow(NoAutorizado);
    }
    expect((await historial(administracion, RUT)).cliente).not.toBeNull();
    expect(await total('reporte')).toBe(0);
  });

  it('la descripción es obligatoria y tiene un largo máximo', () => {
    expect(() => reporte('advertencia', ' ')).toThrow('Describe lo que pasó');
    expect(() => reporte('advertencia', 'x'.repeat(1001))).toThrow('hasta 1000 caracteres');
    expect(() => reporte('nada' as DatosReporte['tipo'], 'Algo')).toThrow(
      'Elige el tipo de reporte',
    );
  });
});

describe('sin noche abierta', () => {
  beforeEach(async () => {
    await prepararNoche({ abrirNoche: false });
    await consultar`
      insert into gesnoc.cliente (documento, nombre, apellido) values (${RUT}, 'Iván', 'Mora')`;
  });

  it('el historial se consulta, pero un reporte no se registra fuera de una noche', async () => {
    expect(await historial(administracion, RUT)).toMatchObject({
      cliente: { nombre: 'Iván' },
      nocheAbierta: false,
    });
    await expect(
      reportar(administracion, reporte('advertencia', 'Fuera de la noche')),
    ).rejects.toThrow('No hay una noche abierta');
    expect(await total('reporte')).toBe(0);
  });
});
