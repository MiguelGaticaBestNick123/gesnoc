import { beforeEach, describe, expect, it } from 'vitest';
import { datosEntrada } from '@/modules/porteria/esquemas';
import { registrar } from '@/modules/porteria/servicios/puerta';
import { bitacora } from '@/modules/noche/servicios/bitacora';
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

describe('bitácora de la noche', () => {
  it('junta lo que hizo cada persona, del más reciente al más antiguo', async () => {
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
    await anular(garzon, { cuenta, pedido: numero, linea: 2 });
    const [barra] = await consultar<{ id: number }[]>`
      select id from gesnoc.estacion where nombre = 'Barra Salón'`;
    await marcarLista(local.persona('barra'), numero, barra!.id);
    const [mesa] = await consultar<{ token_qr: string }[]>`
      select token_qr from gesnoc.mesa where id = ${local.mesa(local.salon, 4)}`;
    await llamar(mesa!.token_qr);
    const [llamado] = await consultar<{ numero: number }[]>`select numero from gesnoc.llamado`;
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

    const { elegida, eventos } = await bitacora(administracion, fecha);
    expect(elegida?.fecha).toBe(fecha);
    const textos = eventos.map((e) => e.texto);
    expect(textos).toEqual(
      expect.arrayContaining([
        'Se abrió la noche',
        `Abrió la cuenta ${cuenta} (mesa 4, Salón)`,
        expect.stringMatching(
          new RegExp(`^Envió el pedido ${numero} \\(cuenta ${cuenta}\\): 2 × Mojito`),
        ),
        `Anuló 1 × Papas fritas del pedido ${numero}`,
        `Barra Salón marcó listo el pedido ${numero}`,
        'La mesa 4 de Salón llamó al garzón',
        'Atendió el llamado de la mesa 4 de Salón',
        'Registró la entrada de Iván Mora (EF) · ticket 1',
      ]),
    );
    const anulacion = eventos.find((e) => e.texto.startsWith('Anuló'));
    expect(anulacion).toMatchObject({ actor: 'Diego Soto', categoria: 'pedidos' });
    // Del más reciente al más antiguo: la entrada fue lo último.
    expect(eventos[0]!.texto).toBe('Registró la entrada de Iván Mora (EF) · ticket 1');
    expect(eventos.at(-1)!.texto).toBe('Se abrió la noche');
  });

  it('solo la administración la ve', async () => {
    for (const persona of ['garzon', 'guardia', 'barra']) {
      await expect(bitacora(local.persona(persona))).rejects.toThrow(NoAutorizado);
    }
  });
});
