import { beforeEach, describe, expect, it } from 'vitest';
import { indicadoresDeLaNoche } from '@/modules/caja/servicios/indicadores';
import { datosEntrada } from '@/modules/porteria/esquemas';
import { registrar } from '@/modules/porteria/servicios/puerta';
import { marcarLista } from '@/modules/venta/servicios/colas';
import { abrir } from '@/modules/venta/servicios/cuentas';
import { atender, llamar } from '@/modules/venta/servicios/llamados';
import { anular, enviar } from '@/modules/venta/servicios/pedidos';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar } from './apoyo';
import { fecha, linea, pedido, prepararNoche, type Local } from './noche-abierta';

conBaseVacia();

let local: Local;
beforeEach(async () => {
  local = await prepararNoche();
});

describe('panel de indicadores de la noche', () => {
  it('sin actividad, la noche aparece en cero', async () => {
    const { elegida, detalle } = await indicadoresDeLaNoche(administracion);
    expect(elegida?.fecha).toBe(fecha);
    expect(detalle).toMatchObject({
      ventasPorHora: [],
      ingresos: 0,
      preparacion: [],
      llamados: { total: 0, atendidos: 0, mediana: null },
      cuentas: { total: 0, vendido: 0, ticketPromedio: 0, duracionMediana: null },
    });
  });

  it('cuenta lo vendido sin lo anulado, las comandas listas, los llamados y los ingresos', async () => {
    const garzon = local.persona('garzon');
    const { numero: cuenta } = await abrir(garzon, { mesaId: local.mesa(local.salon, 4) });
    const { numero } = await enviar(
      garzon,
      pedido(
        cuenta,
        [linea(local.producto('Mojito'), 2), linea(local.producto('Papas fritas'))],
        2,
      ),
    );
    // La papas fritas se anula: no cuenta como vendido.
    await anular(garzon, { cuenta, pedido: numero, linea: 2 });
    const [barra] = await consultar<{ id: number }[]>`
      select id from gesnoc.estacion where nombre = 'Barra Salón'`;
    await marcarLista(local.persona('barra'), numero, barra!.id);

    const [mesa] = await consultar<{ token_qr: string }[]>`
      select token_qr from gesnoc.mesa where id = ${local.mesa(local.salon, 4)}`;
    await llamar(mesa!.token_qr);
    await llamar(
      (
        await consultar<{ token_qr: string }[]>`
          select token_qr from gesnoc.mesa where id = ${local.mesa(local.salon, 5)}`
      )[0]!.token_qr,
    );
    const [llamado] = await consultar<{ numero: number }[]>`
      select numero from gesnoc.llamado order by numero limit 1`;
    await atender(garzon, llamado!.numero);

    await registrar(
      local.persona('guardia'),
      datosEntrada.parse({
        tipoDocumento: 'rut',
        documento: '12345678-5',
        nombre: 'Iván',
        apellido: 'Mora',
        forma: 'efectivo',
        monto: 5000,
      }),
    );

    const { detalle } = await indicadoresDeLaNoche(administracion, fecha);
    const [mojito] = await consultar<{ precio: number }[]>`
      select precio from gesnoc.producto where nombre = 'Mojito'`;
    const vendido = 2 * mojito!.precio;

    expect(detalle!.cuentas).toMatchObject({ total: 1, vendido, ticketPromedio: vendido });
    expect(detalle!.ventasPorHora.reduce((suma, p) => suma + p.total, 0)).toBe(vendido);
    expect(detalle!.preparacion).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ estacion: 'Barra Salón', listas: 1, pendientes: 0 }),
      ]),
    );
    const barraSalon = detalle!.preparacion.find((f) => f.estacion === 'Barra Salón')!;
    expect(barraSalon.mediana).toBeGreaterThanOrEqual(0);
    expect(detalle!.llamados).toMatchObject({ total: 2, atendidos: 1 });
    expect(detalle!.llamados.mediana).toBeGreaterThanOrEqual(0);
    expect(detalle!.ingresos).toBe(1);
    expect(detalle!.ingresosPorForma).toEqual({ efectivo: 1, tarjeta: 0, pendiente: 0, gratis: 0 });
    expect(detalle!.ingresosPorHora.reduce((suma, p) => suma + p.total, 0)).toBe(1);
  });

  it('solo la administración ve los indicadores', async () => {
    for (const persona of ['garzon', 'barra', 'guardia']) {
      await expect(indicadoresDeLaNoche(local.persona(persona))).rejects.toThrow(NoAutorizado);
    }
  });
});
