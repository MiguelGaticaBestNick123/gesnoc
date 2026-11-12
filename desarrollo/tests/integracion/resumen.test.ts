import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { anular, enviar } from '@/modules/venta/servicios/pedidos';
import { abrir } from '@/modules/venta/servicios/cuentas';
import { cobrar } from '@/modules/venta/servicios/pagos';
import { resumenDeLaNoche } from '@/modules/venta/servicios/resumen';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar } from './apoyo';
import { fecha, linea, pedido, prepararNoche } from './noche-abierta';

conBaseVacia();

describe('resumen de la noche en la portada de la administración', () => {
  it('cifras reales: vendido sin anulados, cobrado, por cobrar y lo que se prepara', async () => {
    const local = await prepararNoche();
    const garzon = local.persona('garzon');
    const garzon2 = local.persona('garzon2');

    const { numero: salon } = await abrir(garzon, { mesaId: local.mesa(local.salon, 1) });
    const enSalon = await enviar(
      garzon,
      pedido(salon, [linea(local.producto('Mojito'), 2), linea(local.producto('Papas fritas'))], 2),
    );
    await anular(garzon, { cuenta: salon, pedido: enSalon.numero, linea: 2 });

    const { numero: terraza } = await abrir(garzon2, { mesaId: local.mesa(local.terraza, 1) });
    await enviar(garzon2, pedido(terraza, [linea(local.producto('Schop'), 3)]));
    await consultar`
      insert into gesnoc.pago (fecha, cuenta_numero, numero, medio, monto, registrado_por, clave_envio)
      values (${fecha}, ${terraza}, 1, 'tarjeta', 5000, ${garzon2.id}, ${randomUUID()})`;

    const resumen = await resumenDeLaNoche(administracion);
    // 2 Mojito (13.000) + 3 Schop (10.500); las papas se anularon.
    expect(resumen.cifras).toEqual({
      vendido: 23500,
      cobrado: 5000,
      cuentasAbiertas: 2,
      porCobrar: 18500,
      enPreparacion: 2,
    });
    // Control: lo vendido es lo cobrado más lo que falta por cobrar.
    expect(resumen.cifras!.cobrado + resumen.cifras!.porCobrar).toBe(resumen.cifras!.vendido);

    expect(resumen.ambientes.map((a) => [a.nombre, a.ocupadas, a.vendido])).toEqual([
      ['Salón', 1, 13000],
      ['Terraza', 1, 10500],
    ]);
    expect(resumen.ultimos.map((p) => p.resumen)).toEqual(['3 × Schop', '2 × Mojito']);
    expect(resumen.masPedidos[0]).toEqual({ producto: 'Schop', unidades: 3, monto: 10500 });
  });

  it('HU-24: lo cobrado por medio de pago, las propinas y el efectivo por confirmar', async () => {
    const local = await prepararNoche();
    const garzon = local.persona('garzon');
    const { numero: cuenta } = await abrir(garzon, { mesaId: local.mesa(local.salon, 1) });
    await enviar(garzon, pedido(cuenta, [linea(local.producto('Mojito'), 2)]));
    const pago = (medio: 'efectivo' | 'tarjeta', monto: number, propina: number) =>
      cobrar(garzon, { cuenta, claveEnvio: randomUUID(), medio, monto, propina });
    await pago('efectivo', 5000, 500);
    await pago('tarjeta', 8000, 800);

    const { cifras, cobros } = await resumenDeLaNoche(administracion);
    expect(cifras).toMatchObject({ vendido: 13000, cobrado: 13000, porCobrar: 0 });
    expect(cobros).toEqual({
      porMedio: [
        { medio: 'efectivo', monto: 5000, pagos: 1 },
        { medio: 'tarjeta', monto: 8000, pagos: 1 },
        { medio: 'transferencia', monto: 0, pagos: 0 },
      ],
      propinas: 1300,
      // RN-17: el efectivo, con su propina, espera a que la administración lo confirme.
      porConfirmar: { monto: 5500, pagos: 1 },
    });

    await consultar`
      update gesnoc.pago set confirmado_por = ${local.persona('admin').id}, confirmado_en = now()
      where medio = 'efectivo'`;
    expect((await resumenDeLaNoche(administracion)).cobros?.porConfirmar).toEqual({
      monto: 0,
      pagos: 0,
    });
  });

  it('sin noche abierta no hay cifras, y solo la administración la ve', async () => {
    const local = await prepararNoche({ abrirNoche: false });
    const resumen = await resumenDeLaNoche(administracion);
    expect(resumen.noche).toBeNull();
    expect(resumen.cifras).toBeNull();
    expect(resumen.cobros).toBeNull();
    await expect(resumenDeLaNoche(local.persona('garzon'))).rejects.toThrow(NoAutorizado);
  });
});
