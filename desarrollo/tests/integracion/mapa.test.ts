import { beforeEach, describe, expect, it } from 'vitest';
import { datosPlano, type DatosPlano } from '@/modules/local/esquemas';
import { guardarPlano, planoParaEditar } from '@/modules/local/servicios/mapa';
import { abrir } from '@/modules/venta/servicios/cuentas';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar } from './apoyo';
import { fecha, prepararNoche, type Local } from './noche-abierta';

conBaseVacia();

let local: Local;
beforeEach(async () => {
  local = await prepararNoche();
});

/** El plano de la Terraza (mesas 1, 2 y 3) tal como lo carga el editor. */
async function terraza() {
  const datos = await planoParaEditar(administracion, local.terraza);
  return { ambienteId: local.terraza, mesas: datos.mesas, retiradas: [] as number[] };
}

const numeros = async (ambienteId: number) => {
  const filas = await consultar<{ numero: number }[]>`
    select numero from gesnoc.mesa where ambiente_id = ${ambienteId} and activa order by numero`;
  return filas.map((f) => f.numero);
};

describe('HU-05 editar el mapa de mesas', () => {
  it('CA1: mueve, redimensiona, rota, cambia la forma y agrega una mesa', async () => {
    const plano = await terraza();
    const [primera, ...resto] = plano.mesas;
    const datos: DatosPlano = {
      ...plano,
      mesas: [
        {
          ...primera!,
          posX: 200,
          posY: 150,
          forma: 'rectangular',
          ancho: 160,
          alto: 80,
          rotacion: 90,
        },
        ...resto,
        { numero: 4, forma: 'redonda', posX: 700, posY: 50, ancho: 90, alto: 90, rotacion: 0 },
      ],
    };

    const mesas = await guardarPlano(administracion, datos);
    expect(mesas.map((m) => m.numero)).toEqual([1, 2, 3, 4]);
    expect(mesas[0]).toMatchObject({ posX: 200, posY: 150, forma: 'rectangular', rotacion: 90 });
    const [nueva] = await consultar<{ token_qr: string }[]>`
      select token_qr from gesnoc.mesa where ambiente_id = ${local.terraza} and numero = 4`;
    expect(nueva?.token_qr).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('una mesa cuadrada o redonda queda con ancho y alto iguales', async () => {
    const plano = await terraza();
    const [primera, ...resto] = plano.mesas;
    // La regla vive en el esquema que valida lo que envía el editor (mesa_proporcion_ck).
    const mesas = await guardarPlano(
      administracion,
      datosPlano.parse({
        ...plano,
        mesas: [{ ...primera!, forma: 'cuadrada', ancho: 120, alto: 60 }, ...resto],
      }),
    );
    expect(mesas[0]).toMatchObject({ ancho: 120, alto: 120 });
  });

  it('intercambia los números de dos mesas en un solo guardado', async () => {
    const plano = await terraza();
    const [uno, dos, tres] = plano.mesas;
    await guardarPlano(administracion, {
      ...plano,
      mesas: [{ ...uno!, numero: 2 }, { ...dos!, numero: 1 }, tres!],
    });
    const [fila] = await consultar<
      { numero: number }[]
    >`select numero from gesnoc.mesa where id = ${uno!.id}`;
    expect(fila?.numero).toBe(2);
  });

  it('CA2: el número no se repite entre las mesas activas del ambiente', async () => {
    const plano = await terraza();
    const [uno, dos, tres] = plano.mesas;
    await expect(
      guardarPlano(administracion, { ...plano, mesas: [uno!, { ...dos!, numero: 1 }, tres!] }),
    ).rejects.toThrow('Hay mesas con el mismo número: 1');
    expect(await numeros(local.terraza)).toEqual([1, 2, 3]);
  });

  it('CA3: retirar libera el número y no toca el historial de la cuenta', async () => {
    const mesaTres = local.mesa(local.terraza, 3);
    const garzon = local.persona('garzon2');
    const { numero: cuenta } = await abrir(garzon, { mesaId: mesaTres });
    await consultar`
      update gesnoc.cuenta set cerrada_por = ${garzon.id}, cerrada_en = now()
      where fecha = ${fecha} and numero = ${cuenta}`;

    const plano = await terraza();
    await guardarPlano(administracion, {
      ...plano,
      mesas: [
        ...plano.mesas.filter((m) => m.id !== mesaTres),
        { numero: 3, forma: 'cuadrada', posX: 700, posY: 150, ancho: 80, alto: 80, rotacion: 0 },
      ],
      retiradas: [mesaTres],
    });

    expect(await numeros(local.terraza)).toEqual([1, 2, 3]);
    const [historial] = await consultar<{ mesa_id: number }[]>`
      select mesa_id from gesnoc.cuenta where fecha = ${fecha} and numero = ${cuenta}`;
    expect(historial?.mesa_id).toBe(mesaTres);
  });

  it('no retira una mesa con una cuenta abierta', async () => {
    const mesaDos = local.mesa(local.terraza, 2);
    await abrir(local.persona('garzon2'), { mesaId: mesaDos });
    const plano = await terraza();
    await expect(
      guardarPlano(administracion, {
        ...plano,
        mesas: plano.mesas.filter((m) => m.id !== mesaDos),
        retiradas: [mesaDos],
      }),
    ).rejects.toThrow('La mesa 2 tiene una cuenta abierta');
  });

  it('una mesa retirada ya no recibe cuentas', async () => {
    const mesaUno = local.mesa(local.terraza, 1);
    const plano = await terraza();
    await guardarPlano(administracion, {
      ...plano,
      mesas: plano.mesas.filter((m) => m.id !== mesaUno),
      retiradas: [mesaUno],
    });
    await expect(abrir(local.persona('garzon2'), { mesaId: mesaUno })).rejects.toThrow(
      'Esa mesa no existe',
    );
  });

  it('no deja una mesa fuera del plano ni guarda mesas de otro ambiente', async () => {
    const plano = await terraza();
    const [uno, ...resto] = plano.mesas;
    await expect(
      guardarPlano(administracion, { ...plano, mesas: [{ ...uno!, posX: 880 }, ...resto] }),
    ).rejects.toThrow('quedó fuera del plano');

    const delSalon = local.mesa(local.salon, 1);
    await expect(
      guardarPlano(administracion, {
        ...plano,
        mesas: [...plano.mesas, { ...uno!, id: delSalon, numero: 9 }],
      }),
    ).rejects.toThrow('El plano cambió');
  });

  it('solo la administración edita el plano', async () => {
    const plano = await terraza();
    await expect(guardarPlano(local.persona('garzon2'), plano)).rejects.toThrow(NoAutorizado);
    await expect(planoParaEditar(local.persona('garzon2'))).rejects.toThrow(NoAutorizado);
  });
});
