import { beforeEach, describe, expect, it } from 'vitest';
import type { DatosEntrada } from '@/modules/porteria/esquemas';
import { datosBusqueda, datosEntrada } from '@/modules/porteria/esquemas';
import { buscar, ingresosDeLaNoche, registrar } from '@/modules/porteria/servicios/puerta';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, consultar } from './apoyo';
import { fecha, prepararNoche, total, type Local } from './noche-abierta';

conBaseVacia();

let local: Local;
beforeEach(async () => {
  local = await prepararNoche();
});

const guardia = () => local.persona('guardia');

/** Lo que envía el teléfono de la puerta, ya validado como en la ruta. */
const entrada = (documento: string, forma: DatosEntrada['forma'], extra: object = {}) =>
  datosEntrada.parse({
    tipoDocumento: 'rut',
    documento,
    nombre: 'Persona',
    apellido: 'De Prueba',
    forma,
    monto: forma === 'gratis' ? 0 : 5000,
    ...extra,
  });

const documento = (texto: string) =>
  datosBusqueda.parse({ tipoDocumento: 'rut', documento: texto }).documento;

describe('HU-30 registrar la entrada con ticket', () => {
  it('CA1: el RUT se normaliza antes de buscar y de registrar (RN-21)', async () => {
    await registrar(guardia(), entrada('12.345.678-5', 'efectivo'));
    const [cliente] = await consultar<
      { documento: string }[]
    >`select documento from gesnoc.cliente`;
    expect(cliente?.documento).toBe('12345678-5');

    const busqueda = await buscar(guardia(), documento('123456785'));
    expect(busqueda.cliente).toMatchObject({ nombre: 'Persona', apellido: 'De Prueba' });
    expect(busqueda.entrada).toMatchObject({ ticket: 1, forma: 'efectivo' });
  });

  it('CA2: una persona entra una sola vez; repetir muestra su entrada con hora y ticket', async () => {
    const primera = await registrar(guardia(), entrada('12345678-5', 'tarjeta'));
    const segunda = await registrar(guardia(), entrada('12.345.678-5', 'efectivo'));
    expect(primera).toMatchObject({ ticket: 1, forma: 'tarjeta', repetida: false });
    expect(segunda).toMatchObject({
      ticket: 1,
      forma: 'tarjeta',
      repetida: true,
      registradaEn: primera.registradaEn,
    });
    expect(await total('entrada')).toBe(1);
  });

  it('CA3: solo las pagadas (EF, RC y PN) reciben ticket, correlativo y sin huecos (RN-22)', async () => {
    const formas = ['efectivo', 'gratis', 'tarjeta', 'pendiente', 'gratis', 'efectivo'] as const;
    const tickets = [];
    for (const [i, forma] of formas.entries()) {
      const rut = [
        '15678234-3',
        '17654321-3',
        '18234567-9',
        '19876543-0',
        '20123456-5',
        '21345678-4',
      ][i]!;
      tickets.push((await registrar(guardia(), entrada(rut, forma))).ticket);
    }
    expect(tickets).toEqual([1, null, 2, 3, null, 4]);

    const filas = await consultar<
      { medio_pago: string | null; monto: number; ticket: number | null }[]
    >`
      select medio_pago, monto, ticket from gesnoc.entrada order by registrada_en`;
    expect(filas.map((f) => [f.medio_pago, f.monto])).toEqual([
      ['efectivo', 5000],
      [null, 0],
      ['tarjeta', 5000],
      // PN: la entrada vale lo mismo, pero se paga después a la administración.
      ['pendiente', 5000],
      [null, 0],
      ['efectivo', 5000],
    ]);
  });

  it('60 ingresos a la vez: tickets del 1 al 60, sin repetir ni saltar', async () => {
    const ruts = Array.from({ length: 60 }, (_, i) => {
      const cuerpo = String(10_000_000 + i * 7919);
      let suma = 0;
      let factor = 2;
      for (const digito of [...cuerpo].reverse()) {
        suma += Number(digito) * factor;
        factor = factor === 7 ? 2 : factor + 1;
      }
      const resto = 11 - (suma % 11);
      return `${cuerpo}-${resto === 11 ? '0' : resto === 10 ? 'K' : resto}`;
    });
    const resultados = await Promise.all(
      ruts.map((rut) => registrar(guardia(), entrada(rut, 'efectivo'))),
    );
    expect(resultados.map((r) => r.ticket).sort((a, b) => a! - b!)).toEqual(
      Array.from({ length: 60 }, (_, i) => i + 1),
    );
  });

  it('dos puertas que registran a la misma persona a la vez dejan una sola entrada', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => registrar(guardia(), entrada('12345678-5', 'efectivo'))),
    );
    expect(resultados.filter((r) => !r.repetida)).toHaveLength(1);
    expect(new Set(resultados.map((r) => r.ticket))).toEqual(new Set([1]));
    expect(await total('entrada')).toBe(1);
    expect(await total('cliente')).toBe(1);
  });

  it('si el precio cambió mientras el guardia miraba, no registra nada y lo dice', async () => {
    await consultar`update gesnoc.noche set precio_entrada = 7000 where fecha = ${fecha}`;
    await expect(registrar(guardia(), entrada('12345678-5', 'efectivo'))).rejects.toThrow(
      'El precio de la entrada cambió a $7.000: confirma el cobro',
    );
    expect(await total('entrada')).toBe(0);
    // Gratis sigue siendo posible (por ejemplo, «gratis hasta las 00:00»).
    await expect(registrar(guardia(), entrada('12345678-5', 'gratis'))).resolves.toMatchObject({
      ticket: null,
    });
  });

  it('a una persona nueva se le pide nombre y apellido', async () => {
    await expect(
      registrar(
        guardia(),
        entrada('12345678-5', 'efectivo', { nombre: undefined, apellido: undefined }),
      ),
    ).rejects.toThrow('escribe su nombre y apellido');
    expect(await total('cliente')).toBe(0);
  });

  it('un documento extranjero se registra en mayúsculas y sin signos', async () => {
    await registrar(guardia(), entrada('ab-123 456', 'efectivo', { tipoDocumento: 'extranjero' }));
    const [cliente] = await consultar<
      { documento: string }[]
    >`select documento from gesnoc.cliente`;
    expect(cliente?.documento).toBe('AB123456');
  });
});

describe('HU-33 listas e invitados en la puerta', () => {
  it('quien viene en una lista trae su nombre y la lista dice si paga', async () => {
    const camila = await buscar(guardia(), '15678234-3');
    expect(camila.cliente).toBeNull();
    expect(camila.invitacion).toMatchObject({
      nombre: 'Camila',
      apellido: 'Rojas',
      lista: 'Cumpleaños de Camila',
      gratis: false,
    });
    const bailarina = await buscar(guardia(), '19876543-0');
    expect(bailarina.invitacion).toMatchObject({ lista: 'Bailarines', gratis: true });
    const invitado = await buscar(guardia(), '16543210-K');
    expect(invitado.invitacion).toMatchObject({
      lista: null,
      invitadoPor: 'DJ de la noche',
      gratis: true,
    });
  });

  it('la administración ve quién de la lista ya entró', async () => {
    await registrar(
      guardia(),
      entrada('19876543-0', 'gratis', { nombre: 'Javiera', apellido: 'Soto' }),
    );
    const { detalleDeNoche } = await import('@/modules/noche/servicios/detalles');
    const noche = await detalleDeNoche(administracion, fecha);
    const bailarines = noche!.listas.find((l) => l.nombre === 'Bailarines')!;
    expect(bailarines.personas.find((p) => p.nombre === 'Javiera')?.entroEn).not.toBeNull();
  });
});

describe('HU-32 estado de la puerta, sin montos', () => {
  it('quién entró: hora, ticket, nombre, documento y forma; nada de lo recaudado', async () => {
    await registrar(guardia(), entrada('12345678-5', 'efectivo'));
    await registrar(
      guardia(),
      entrada('16543210-K', 'gratis', { nombre: 'Felipe', apellido: 'Araya' }),
    );
    const estado = await ingresosDeLaNoche(guardia());
    expect(estado.noche).toBe(fecha);
    expect(estado.ultimoTicket).toBe(1);
    expect(estado.ingresos.map((i) => [i.nombre, i.ticket, i.forma, i.documento])).toEqual([
      ['Felipe', null, 'gratis', '16543210-K'],
      ['Persona', 1, 'efectivo', '12345678-5'],
    ]);
    expect(JSON.stringify(estado)).not.toMatch(/monto|recaudado|total/);
  });

  it('quien viene en una lista gratis entra sin ticket, sin medio y sin monto', async () => {
    const bailarina = await registrar(
      guardia(),
      entrada('19876543-0', 'gratis', { nombre: 'Javiera', apellido: 'Soto' }),
    );
    expect(bailarina).toMatchObject({ ticket: null, forma: 'gratis' });
    const [fila] = await consultar<{ monto: number; medio_pago: string | null; ticket: null }[]>`
      select monto, medio_pago, ticket from gesnoc.entrada`;
    expect(fila).toEqual({ monto: 0, medio_pago: null, ticket: null });
  });

  it('cuenta las visitas de las noches anteriores', async () => {
    await registrar(guardia(), entrada('12345678-5', 'efectivo'));
    const [cliente] = await consultar<{ id: number }[]>`select id from gesnoc.cliente`;
    await consultar`
      insert into gesnoc.entrada (fecha, cliente_id, monto, medio_pago, ticket, registrada_por)
      values ('2026-10-24', ${cliente!.id}, 5000, 'efectivo', 1, ${guardia().id}),
             ('2026-10-31', ${cliente!.id}, 0, null, null, ${guardia().id})`;
    expect((await buscar(guardia(), '12345678-5')).cliente?.visitas).toBe(2);
  });
});

describe('permisos y noche (RN-25, RN-26)', () => {
  it('solo el guardia y la administración ven y registran clientes', async () => {
    for (const persona of ['garzon', 'barra', 'cocina']) {
      await expect(buscar(local.persona(persona), '12345678-5')).rejects.toThrow(NoAutorizado);
      await expect(
        registrar(local.persona(persona), entrada('12345678-5', 'gratis')),
      ).rejects.toThrow(NoAutorizado);
    }
    await expect(
      registrar(local.persona('admin'), entrada('12345678-5', 'gratis')),
    ).resolves.toMatchObject({ repetida: false });
  });

  it('sin una noche abierta la puerta no registra', async () => {
    await consultar`update gesnoc.noche set cerrada_en = now() + interval '1 hour' where fecha = ${fecha}`;
    await expect(registrar(guardia(), entrada('12345678-5', 'gratis'))).rejects.toThrow(
      'No hay una noche abierta',
    );
    expect((await ingresosDeLaNoche(guardia())).noche).toBeNull();
  });
});
