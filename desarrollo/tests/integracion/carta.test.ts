import { beforeEach, describe, expect, it } from 'vitest';
import { cartaDeMesa } from '@/modules/local/servicios/carta';
import { archivoDelCodigo, codigosDeMesas, regenerarCodigo } from '@/modules/local/servicios/qr';
import { misComandas } from '@/modules/venta/servicios/colas';
import {
  atender,
  CODIGO_SIN_CARTA,
  LOCAL_SIN_ATENCION,
  llamar,
} from '@/modules/venta/servicios/llamados';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, conTurno, consultar } from './apoyo';
import { prepararNoche, total, type Local } from './noche-abierta';

conBaseVacia();

const ORIGEN = 'https://gesnoc.example';

async function codigoDe(mesaId: number) {
  const [fila] = await consultar<{ token_qr: string }[]>`
    select token_qr from gesnoc.mesa where id = ${mesaId}`;
  return fila!.token_qr;
}

describe('HU-38 carta pública', () => {
  let local: Local;
  beforeEach(async () => {
    local = await prepararNoche();
  });

  it('CA1 y CA2: el código abre la carta de su mesa con los productos activos, por categoría', async () => {
    await consultar`update gesnoc.producto set activo = false where id = ${local.producto('Mojito')}`;
    const carta = await cartaDeMesa(await codigoDe(local.mesa(local.salon, 4)));

    expect(carta).toMatchObject({
      mesa: 4,
      ambiente: 'Salón',
      atendiendo: true,
      llamadoPendiente: false,
    });
    const nombres = carta!.categorias.flatMap((c) => c.productos.map((p) => p.nombre));
    expect(nombres).not.toContain('Mojito');
    expect(nombres).toContain('Papas fritas');
    const [activos] = await consultar<{ n: number }[]>`
      select count(*)::int as n from gesnoc.producto where activo`;
    expect(nombres).toHaveLength(activos!.n);
    expect(carta!.categorias.find((c) => c.nombre === 'Tragos')).toBeDefined();
  });

  it('CA3: no trae datos de cuentas, clientes ni personal', async () => {
    const carta = await cartaDeMesa(await codigoDe(local.mesa(local.salon, 4)));
    expect(Object.keys(carta!).sort()).toEqual([
      'ambiente',
      'atendiendo',
      'categorias',
      'llamadoPendiente',
      'mesa',
    ]);
    for (const categoria of carta!.categorias) {
      expect(Object.keys(categoria).sort()).toEqual(['id', 'nombre', 'productos']);
      for (const producto of categoria.productos) {
        expect(Object.keys(producto).sort()).toEqual(['id', 'nombre', 'precio']);
      }
    }
  });

  it('un código desconocido, mal formado o de una mesa retirada no abre nada', async () => {
    expect(await cartaDeMesa('a'.repeat(22))).toBeNull();
    expect(await cartaDeMesa("x' or '1'='1")).toBeNull();
    const mesa = local.mesa(local.salon, 4);
    const codigo = await codigoDe(mesa);
    await consultar`update gesnoc.mesa set activa = false where id = ${mesa}`;
    expect(await cartaDeMesa(codigo)).toBeNull();
  });
});

describe('HU-07 códigos QR', () => {
  let local: Local;
  beforeEach(async () => {
    local = await prepararNoche({ abrirNoche: false });
  });

  it('CA1: cada mesa activa del ambiente tiene su propio código y su enlace', async () => {
    const datos = await codigosDeMesas(administracion, ORIGEN, local.salon);
    const [mesas] = await consultar<{ n: number }[]>`
      select count(*)::int as n from gesnoc.mesa where ambiente_id = ${local.salon} and activa`;

    expect(datos.ambiente?.nombre).toBe('Salón');
    expect(datos.mesas).toHaveLength(mesas!.n);
    expect(new Set(datos.mesas.map((m) => m.enlace)).size).toBe(mesas!.n);
    expect(datos.mesas[0]!.enlace).toMatch(/^https:\/\/gesnoc\.example\/carta\/[\w-]{22}$/);
    expect(datos.mesas[0]!.svg).toMatch(/^<svg/);
  });

  it('CA2 (RN-28): al regenerar, el código anterior deja de abrir la carta', async () => {
    const mesa = local.mesa(local.salon, 4);
    const anterior = await codigoDe(mesa);
    await regenerarCodigo(administracion, mesa);
    const nuevo = await codigoDe(mesa);

    expect(nuevo).not.toBe(anterior);
    expect(await cartaDeMesa(anterior)).toBeNull();
    expect(await cartaDeMesa(nuevo)).toMatchObject({ mesa: 4, ambiente: 'Salón' });
  });

  it('CA3: el código se descarga como SVG con un nombre legible', async () => {
    const archivo = await archivoDelCodigo(administracion, ORIGEN, local.mesa(local.salon, 4));
    expect(archivo.nombre).toBe('qr-salon-mesa-4.svg');
    expect(archivo.svg).toMatch(/^<svg/);
  });

  it('solo la administración ve, descarga y regenera códigos', async () => {
    const mesa = local.mesa(local.salon, 4);
    await expect(codigosDeMesas(conTurno('garzon'), ORIGEN)).rejects.toThrow(NoAutorizado);
    await expect(archivoDelCodigo(conTurno('garzon'), ORIGEN, mesa)).rejects.toThrow(NoAutorizado);
    await expect(regenerarCodigo(conTurno('garzon'), mesa)).rejects.toThrow(NoAutorizado);
  });

  it('una mesa retirada no se regenera', async () => {
    const mesa = local.mesa(local.salon, 4);
    await consultar`update gesnoc.mesa set activa = false where id = ${mesa}`;
    await expect(regenerarCodigo(administracion, mesa)).rejects.toThrow('fue retirada');
  });
});

describe('HU-39 y HU-40 llamados', () => {
  let local: Local;
  let codigo: string;
  beforeEach(async () => {
    local = await prepararNoche();
    codigo = await codigoDe(local.mesa(local.salon, 4));
  });

  it('HU-39 CA1 y HU-40 CA1: el llamado queda pendiente y llega solo a los garzones del ambiente', async () => {
    expect(await llamar(codigo)).toEqual({ avisado: true });
    expect((await cartaDeMesa(codigo))!.llamadoPendiente).toBe(true);

    expect((await misComandas(local.persona('garzon'))).llamados).toEqual([
      expect.objectContaining({ mesa: 4, ambiente: 'Salón' }),
    ]);
    expect((await misComandas(local.persona('garzon2'))).llamados).toEqual([]);
  });

  it('HU-39 CA2 (RN-29): otro toque con el llamado pendiente no crea otro, ni a la vez', async () => {
    await llamar(codigo);
    await Promise.all([llamar(codigo), llamar(codigo)]);
    expect(await total('llamado')).toBe(1);
  });

  it('HU-40 CA2: atender registra quién y cuándo y deja de mostrarse; repetirlo no cambia nada', async () => {
    await llamar(codigo);
    const garzon = local.persona('garzon');
    const [pendiente] = (await misComandas(garzon)).llamados;
    await atender(garzon, pendiente!.numero);
    const [antes] = await consultar<{ atendido_en: Date }[]>`
      select atendido_en from gesnoc.llamado`;
    await atender(garzon, pendiente!.numero);

    const [fila] = await consultar<{ atendido_por: number; atendido_en: Date }[]>`
      select atendido_por, atendido_en from gesnoc.llamado`;
    expect(fila!.atendido_por).toBe(garzon.id);
    expect(fila!.atendido_en).toEqual(antes!.atendido_en);
    expect((await misComandas(garzon)).llamados).toEqual([]);
    expect((await cartaDeMesa(codigo))!.llamadoPendiente).toBe(false);

    // Ya atendida, la mesa puede volver a llamar.
    await llamar(codigo);
    expect(await total('llamado')).toBe(2);
  });

  it('HU-40 CA1 (RN-14): no lo atiende un garzón de otro ambiente ni otro rol', async () => {
    await llamar(codigo);
    const [pendiente] = (await misComandas(local.persona('garzon'))).llamados;
    await expect(atender(local.persona('garzon2'), pendiente!.numero)).rejects.toThrow(
      NoAutorizado,
    );
    await expect(atender(local.persona('barra'), pendiente!.numero)).rejects.toThrow(NoAutorizado);
    await expect(atender(local.persona('garzon'), 999)).rejects.toThrow('Ese llamado no existe');
  });

  it('la administración ve los llamados de todo el local', async () => {
    await llamar(codigo);
    await llamar(await codigoDe(local.mesa(local.terraza, 1)));
    const ambientes = (await misComandas(administracion)).llamados.map((l) => l.ambiente);
    expect(ambientes.sort()).toEqual(['Salón', 'Terraza']);
  });

  it('RN-28: un código regenerado ya no llama', async () => {
    await regenerarCodigo(administracion, local.mesa(local.salon, 4));
    await expect(llamar(codigo)).rejects.toThrow(CODIGO_SIN_CARTA);
    expect(await total('llamado')).toBe(0);
  });
});

describe('sin noche abierta', () => {
  let codigo: string;
  beforeEach(async () => {
    const local = await prepararNoche({ abrirNoche: false });
    codigo = await codigoDe(local.mesa(local.salon, 4));
  });

  it('la carta se ve, pero el llamado no se registra', async () => {
    expect(await cartaDeMesa(codigo)).toMatchObject({ atendiendo: false, llamadoPendiente: false });
    await expect(llamar(codigo)).rejects.toThrow(LOCAL_SIN_ATENCION);
    expect(await total('llamado')).toBe(0);
  });
});
