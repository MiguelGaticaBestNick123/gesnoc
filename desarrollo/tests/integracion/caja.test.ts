import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { describirDiferencia, repartir } from '@/modules/caja/calculos';
import * as caja from '@/modules/caja/servicios/caja';
import * as ambientes from '@/modules/local/servicios/ambientes';
import * as noches from '@/modules/noche/servicios/noches';
import { datosEntrada } from '@/modules/porteria/esquemas';
import { registrar } from '@/modules/porteria/servicios/puerta';
import type { MedioDePago } from '@/modules/venta/cuenta';
import { abrir } from '@/modules/venta/servicios/cuentas';
import { cobrar } from '@/modules/venta/servicios/pagos';
import { enviar } from '@/modules/venta/servicios/pedidos';
import type { Actor } from '@/shared/autorizacion';
import { NoAutorizado } from '@/shared/errores';
import { conBaseVacia, consultar } from './apoyo';
import { fecha, linea, pedido, prepararNoche, type Local } from './noche-abierta';

conBaseVacia();

const FONDO = 50_000;
let local: Local;
let admin: Actor;
let diego: Actor;
let paula: Actor;

beforeEach(async () => {
  local = await prepararNoche({ abrirNoche: false });
  await noches.abrir(local.persona('admin'), fecha, FONDO);
  // Las personas con su turno en la noche recién abierta.
  const conTurno = async (clave: string): Promise<Actor> => {
    const [fila] = await consultar<{ id: number; rol: string; ambiente_id: number | null }[]>`
      select u.id, a.rol, a.ambiente_id from gesnoc.usuario u
      join gesnoc.asignacion a on a.usuario_id = u.id and a.fecha = ${fecha}
      where u.correo = ${`${clave}@gesnoc.test`}`;
    return {
      id: fila!.id,
      nombre: clave,
      esAdministrador: false,
      turno: { fecha, rol: fila!.rol as never, ambienteId: fila!.ambiente_id },
    };
  };
  const [filaAdmin] = await consultar<{ id: number }[]>`
    select id from gesnoc.usuario where correo = 'admin@gesnoc.test'`;
  admin = { id: filaAdmin!.id, nombre: 'admin', esAdministrador: true, turno: null };
  diego = await conTurno('garzon');
  paula = await conTurno('garzon2');
});

/** Abre una cuenta en una mesa y le carga un pedido; devuelve el número de la cuenta. */
async function cuentaCon(garzon: Actor, ambiente: number, mesa: number, productos: string[]) {
  const { numero } = await abrir(garzon, { mesaId: local.mesa(ambiente, mesa) });
  await enviar(
    garzon,
    pedido(
      numero,
      productos.map((p) => linea(local.producto(p))),
      2,
    ),
  );
  return numero;
}

const pagar = (garzon: Actor, cuenta: number, medio: MedioDePago, monto: number, propina = 0) =>
  cobrar(garzon, { cuenta, claveEnvio: randomUUID(), medio, monto, propina });

const entrada = (documento: string, forma: 'efectivo' | 'tarjeta' | 'pendiente' | 'gratis') =>
  datosEntrada.parse({
    tipoDocumento: 'rut',
    documento,
    nombre: 'Cliente',
    apellido: 'De Prueba',
    forma,
    monto: forma === 'gratis' ? 0 : 5000,
  });

const guardia = async (): Promise<Actor> => {
  const [fila] = await consultar<{ id: number }[]>`
    select id from gesnoc.usuario where correo = 'guardia@gesnoc.test'`;
  return {
    id: fila!.id,
    nombre: 'guardia',
    esAdministrador: false,
    turno: { fecha, rol: 'guardia', ambienteId: null },
  };
};

describe('propinas', () => {
  it('se reparten parejo a la decena y suman exacto', () => {
    expect(repartir(3000, 2)).toEqual([1500, 1500]);
    expect(repartir(23_455, 3)).toEqual([7820, 7820, 7815]);
    expect(repartir(100, 3)).toEqual([40, 30, 30]);
    expect(repartir(5000, 0)).toEqual([]);
    expect([-2000, 0, 500].map(describirDiferencia)).toEqual([
      'faltan $2.000',
      'cuadra',
      'sobran $500',
    ]);
    for (const total of [0, 7, 999, 12_345, 100_001]) {
      for (const personas of [1, 2, 3, 4, 7]) {
        const partes = repartir(total, personas);
        expect(partes.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...partes) - Math.min(...partes)).toBeLessThan(20);
      }
    }
  });
});

describe('HU-26 confirmar el efectivo', () => {
  it('agrupa por garzón y confirma solo los pagos que se vieron, con quién y cuándo', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    await pagar(diego, mesa4, 'efectivo', 3000, 500);
    const mesa2 = await cuentaCon(paula, local.terraza, 2, ['Piscola']);
    await pagar(paula, mesa2, 'efectivo', 6000);

    const { garzones } = await caja.pantallaEfectivo(admin);
    expect(garzones.map((g) => [g.garzon, g.monto, g.propinas, g.pagos.length])).toEqual([
      ['Diego Soto', 3000, 500, 1],
      ['Paula Vera', 6000, 0, 1],
    ]);

    // Mientras la administración miraba, Diego cobró otro efectivo: ese no se confirma.
    const vistos = garzones[0]!.pagos.map(({ cuenta, numero }) => ({ cuenta, numero }));
    await pagar(diego, mesa4, 'efectivo', 3500);
    expect(await caja.confirmarEfectivo(admin, vistos)).toEqual({ confirmados: 1, monto: 3500 });

    const despues = await caja.pantallaEfectivo(admin);
    expect(despues.garzones.map((g) => [g.garzon, g.monto])).toEqual([
      ['Diego Soto', 3500],
      ['Paula Vera', 6000],
    ]);
    const [confirmado] = await consultar<{ confirmado_por: number; confirmado_en: Date }[]>`
      select confirmado_por, confirmado_en from gesnoc.pago
      where fecha = ${fecha} and cuenta_numero = ${mesa4} and numero = 1`;
    expect(confirmado?.confirmado_por).toBe(admin.id);
    expect(confirmado?.confirmado_en).not.toBeNull();
  });

  it('dos administraciones que confirman a la vez confirman una sola vez', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    await pagar(diego, mesa4, 'efectivo', 6500);
    const pagos = [{ cuenta: mesa4, numero: 1 }];
    const resultados = await Promise.all([
      caja.confirmarEfectivo(admin, pagos),
      caja.confirmarEfectivo(admin, pagos),
    ]);
    expect(resultados.map((r) => r.confirmados).sort()).toEqual([0, 1]);
  });

  it('solo se confirma efectivo (RN-17)', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    await pagar(diego, mesa4, 'tarjeta', 6500);
    expect(await caja.confirmarEfectivo(admin, [{ cuenta: mesa4, numero: 1 }])).toEqual({
      confirmados: 0,
      monto: 0,
    });
  });
});

describe('HU-27 cerrar una cuenta con saldo', () => {
  it('la cierra la administración, queda quién y el saldo sigue derivado', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito', 'Piscola']);
    await pagar(diego, mesa4, 'tarjeta', 5000);
    const { cuentas } = await caja.pantallaSaldos(admin);
    expect(cuentas.map((c) => [c.ubicacion, c.consumo, c.pagado, c.saldo])).toEqual([
      ['Mesa 4', 12_500, 5000, 7500],
    ]);
    expect(await caja.cerrarConSaldo(admin, mesa4)).toEqual({ saldo: 7500 });
    const [cuenta] = await consultar<{ cerrada_por: number }[]>`
      select cerrada_por from gesnoc.cuenta where fecha = ${fecha} and numero = ${mesa4}`;
    expect(cuenta?.cerrada_por).toBe(admin.id);
    expect((await caja.pantallaSaldos(admin)).cuentas).toEqual([]);
  });

  it('solo la administración (RN-18)', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    await expect(caja.cerrarConSaldo(diego, mesa4)).rejects.toThrow(NoAutorizado);
  });

  it('contra un cobro simultáneo, gana el primero', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    const resultados = await Promise.allSettled([
      pagar(diego, mesa4, 'efectivo', 6500),
      caja.cerrarConSaldo(admin, mesa4),
    ]);
    const exitos = resultados.filter((r) => r.status === 'fulfilled');
    expect(exitos).toHaveLength(1);
    const fallo = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(String(fallo.reason)).toMatch(/cerrada/);
  });
});

describe('HU-28 arqueo', () => {
  it('CA1 (RN-19): esperado = fondo + efectivo confirmado con propinas + entradas EF', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito', 'Piscola']);
    await pagar(diego, mesa4, 'efectivo', 12_500, 1250);
    const mesa2 = await cuentaCon(paula, local.terraza, 2, ['Piscola']);
    await pagar(paula, mesa2, 'tarjeta', 6000, 600);
    const mesa5 = await cuentaCon(diego, local.salon, 5, ['Schop']);
    await pagar(diego, mesa5, 'efectivo', 3500);
    const puerta = await guardia();
    await registrar(puerta, entrada('12345678-5', 'efectivo'));
    await registrar(puerta, entrada('15678234-3', 'tarjeta'));
    await registrar(puerta, entrada('17654321-3', 'pendiente'));
    await registrar(puerta, entrada('18234567-9', 'gratis'));

    // Sin confirmar, el efectivo de los garzones todavía no está en la caja.
    expect((await caja.pantallaArqueo(admin)).esperado?.total).toBe(FONDO + 5000);
    await caja.confirmarEfectivo(admin, [{ cuenta: mesa4, numero: 1 }]);
    const { esperado } = await caja.pantallaArqueo(admin);
    // Cálculo de control: 50.000 + 12.500 + 1.250 + 5.000 (la entrada PN no está en la caja).
    expect(esperado).toEqual({
      fondo: FONDO,
      pagos: 12_500,
      propinas: 1250,
      cantidadPagos: 1,
      entradas: 5000,
      cantidadEntradas: 1,
      total: 68_750,
    });
  });

  it('CA2 (RN-20): con diferencia la nota es obligatoria; sin ella no se guarda', async () => {
    await expect(caja.contar(admin, FONDO - 2000, null)).rejects.toThrow(
      'El contado no cuadra con el esperado (faltan $2.000)',
    );
    expect((await caja.pantallaArqueo(admin)).conteo?.contado).toBeNull();
    await caja.contar(admin, FONDO - 2000, 'Faltó un vuelto de $2.000');
    expect((await caja.pantallaArqueo(admin)).conteo).toEqual({
      contado: 48_000,
      nota: 'Faltó un vuelto de $2.000',
      contadoPor: 'Carla Muñoz',
    });
    // Se puede volver a contar; si cuadra, no hace falta nota.
    await expect(caja.contar(admin, FONDO, null)).resolves.toMatchObject({ diferencia: 0 });
  });
});

describe('HU-12 cerrar la noche', () => {
  it('CA1 (RN-20): con pendientes no cierra y dice cuáles', async () => {
    await cuentaCon(diego, local.salon, 4, ['Mojito']);
    const mesa5 = await cuentaCon(diego, local.salon, 5, ['Schop']);
    await pagar(diego, mesa5, 'efectivo', 3500);
    await expect(caja.cerrarNoche(admin, fecha)).rejects.toThrow(
      'No se puede cerrar: queda 1 cuenta abierta, 1 pago en efectivo sin confirmar y la caja sin contar',
    );
    const [noche] = await consultar<{ cerrada_en: Date | null }[]>`
      select cerrada_en from gesnoc.noche where fecha = ${fecha}`;
    expect(noche?.cerrada_en).toBeNull();
  });

  it('si entra efectivo después de contar, el conteo y su nota dejan de valer', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    await pagar(diego, mesa4, 'efectivo', 6500);
    // Faltaban $2.000 y se explicó; después se confirma más efectivo.
    await caja.contar(admin, FONDO - 2000, 'Vuelto mal dado');
    await caja.confirmarEfectivo(admin, [{ cuenta: mesa4, numero: 1 }]);
    expect((await caja.pantallaArqueo(admin)).conteo).toMatchObject({ contado: null, nota: null });
    await expect(caja.cerrarNoche(admin, fecha)).rejects.toThrow('queda la caja sin contar');

    // Una entrada en efectivo también cambia el esperado.
    await caja.contar(admin, FONDO + 6500, null);
    await registrar(await guardia(), entrada('12345678-5', 'efectivo'));
    expect((await caja.pantallaArqueo(admin)).conteo?.contado).toBeNull();
    // Una tarjeta no toca la caja: el conteo sigue.
    await caja.contar(admin, FONDO + 11_500, null);
    await registrar(await guardia(), entrada('15678234-3', 'tarjeta'));
    expect((await caja.pantallaArqueo(admin)).conteo?.contado).toBe(FONDO + 11_500);
  });

  it('cierra, anonimiza a quien no vino en 12 meses y después nada se registra (RN-25, RN-26)', async () => {
    // Un cliente de hace dos años y otro que vino hace un mes.
    await consultar`
      insert into gesnoc.noche (fecha, precio_entrada, abierta_en, cerrada_en)
      values ('2024-10-05', 4000, '2024-10-05 22:00-03', '2024-10-06 05:00-03'),
             ('2026-10-10', 5000, '2026-10-10 22:00-03', '2026-10-11 05:00-03')`;
    const clientes = await consultar<{ id: number }[]>`
      insert into gesnoc.cliente (documento, nombre, apellido)
      values ('11111111-1', 'Antiguo', 'Cliente'), ('22222222-2', 'Reciente', 'Cliente')
      returning id`;
    await consultar`
      insert into gesnoc.entrada (fecha, cliente_id, monto, medio_pago, ticket, registrada_por)
      values ('2024-10-05', ${clientes[0]!.id}, 4000, 'efectivo', 1, ${admin.id}),
             ('2026-10-10', ${clientes[1]!.id}, 5000, 'efectivo', 1, ${admin.id})`;
    await consultar`
      insert into gesnoc.reporte (cliente_id, numero, fecha, tipo, descripcion, registrado_por)
      values (${clientes[0]!.id}, 1, '2024-10-05', 'advertencia', 'Discutió en la barra', ${admin.id})`;

    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    await pagar(diego, mesa4, 'efectivo', 6500);
    await caja.confirmarEfectivo(admin, [{ cuenta: mesa4, numero: 1 }]);
    await caja.contar(admin, FONDO + 6500, null);

    expect(await caja.cerrarNoche(admin, fecha)).toEqual({ anonimizados: 1 });
    const filas = await consultar<{ documento: string; nombre: string }[]>`
      select documento, nombre from gesnoc.cliente order by id`;
    expect(filas).toEqual([
      { documento: `ANON${clientes[0]!.id}`, nombre: 'Anónimo' },
      { documento: '22222222-2', nombre: 'Reciente' },
    ]);
    const [reporte] = await consultar<
      { descripcion: string }[]
    >`select descripcion from gesnoc.reporte`;
    expect(reporte?.descripcion).toBe('Anonimizado');

    // RN-26: la noche cerrada no admite operaciones.
    await expect(cuentaCon(diego, local.salon, 6, ['Schop'])).rejects.toThrow(
      'No hay una noche abierta',
    );
    await expect(registrar(await guardia(), entrada('12345678-5', 'gratis'))).rejects.toThrow(
      'No hay una noche abierta',
    );
    await expect(caja.cerrarNoche(admin, fecha)).rejects.toThrow('Esa noche no está abierta');
  });

  it('una operación que llega con el cierre en curso espera y después se rechaza', async () => {
    await caja.contar(admin, FONDO, null);
    const resultados = await Promise.allSettled([
      caja.cerrarNoche(admin, fecha),
      abrir(diego, { mesaId: local.mesa(local.salon, 7) }),
    ]);
    const cierre = resultados[0]!;
    const apertura = resultados[1]!;
    // O la cuenta entró antes del cierre (y el cierre la ve abierta y no cierra), o el cierre ganó
    // y la cuenta se rechaza: nunca una cuenta abierta en una noche cerrada.
    const [abiertasEnCerrada] = await consultar<{ n: number }[]>`
      select count(*)::int as n from gesnoc.cuenta c join gesnoc.noche n on n.fecha = c.fecha
      where n.cerrada_en is not null and c.cerrada_en is null`;
    expect(abiertasEnCerrada?.n).toBe(0);
    expect(cierre.status === 'fulfilled' || apertura.status === 'fulfilled').toBe(true);
  });
});

describe('HU-29 ventas y propinas', () => {
  it('cifras por ambiente que cuadran y la propina repartida entre garzones y barman', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito', 'Piscola']);
    await pagar(diego, mesa4, 'efectivo', 12_500, 1300);
    const mesa5 = await cuentaCon(diego, local.salon, 5, ['Schop']);
    await pagar(diego, mesa5, 'tarjeta', 2000, 200);
    await caja.cerrarConSaldo(admin, mesa5);
    const mesa2 = await cuentaCon(paula, local.terraza, 2, ['Piscola']);
    await pagar(paula, mesa2, 'transferencia', 3000, 450);

    const { detalle } = await caja.ventasYPropinas(admin);
    const { totales } = detalle!;
    // Control: vendido = cobrado + por cobrar + cerrado con saldo.
    expect(totales).toEqual({
      vendido: 22_000,
      cobrado: 17_500,
      propinas: 1950,
      porCobrar: 3000,
      cerradoConSaldo: 1500,
    });
    expect(totales.vendido).toBe(totales.cobrado + totales.porCobrar + totales.cerradoConSaldo);

    const salon = detalle!.ambientes.find((a) => a.ambiente === 'Salón')!;
    // Salón: $1.500 de propinas entre Diego (garzón) y Tomás (barra); la cocina no recibe.
    expect(salon.reparto.map((p) => [p.nombre, p.rol, p.parte])).toEqual([
      ['Diego Soto', 'garzon', 750],
      ['Tomás Reyes', 'barman', 750],
    ]);
    const terraza = detalle!.ambientes.find((a) => a.ambiente === 'Terraza')!;
    expect(terraza.reparto.map((p) => p.parte)).toEqual([230, 220]);
  });

  it('solo la administración ve la caja', async () => {
    await expect(caja.ventasYPropinas(diego)).rejects.toThrow(NoAutorizado);
    await expect(caja.pantallaArqueo(diego)).rejects.toThrow(NoAutorizado);
    await expect(caja.pantallaEfectivo(await guardia())).rejects.toThrow(NoAutorizado);
  });
});

describe('ajustes de la auditoría (12 nov)', () => {
  it('no se desactiva un ambiente con cuentas abiertas o comandas sin entregar esta noche', async () => {
    await cuentaCon(diego, local.salon, 4, ['Mojito']);
    await expect(ambientes.cambiarActivo(admin, local.salon, false)).rejects.toThrow(
      'cuentas abiertas o comandas sin entregar',
    );
    // La Terraza no tiene nada abierto: se puede desactivar.
    await expect(ambientes.cambiarActivo(admin, local.terraza, false)).resolves.toBeUndefined();
  });

  it('un reintento de cobro recibe el pago registrado aunque la noche ya se cerró (RN-13)', async () => {
    const mesa4 = await cuentaCon(diego, local.salon, 4, ['Mojito']);
    const cobro = {
      cuenta: mesa4,
      claveEnvio: randomUUID(),
      medio: 'tarjeta' as const,
      monto: 6500,
      propina: 0,
    };
    const primero = await cobrar(diego, cobro);
    await caja.contar(admin, FONDO, null);
    await caja.cerrarNoche(admin, fecha);
    // Ya sin turno (la noche se cerró), el mismo garzón reintenta con la misma clave.
    const sinTurno = { ...diego, turno: null };
    await expect(cobrar(sinTurno, cobro)).resolves.toMatchObject({
      numero: primero.numero,
      saldo: 0,
      cerrada: true,
      repetido: true,
    });
    // Otra persona con la clave no recibe el pago.
    await expect(cobrar({ ...paula, turno: null }, cobro)).rejects.toThrow(NoAutorizado);
  });
});
