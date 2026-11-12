import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

// Se conecta con el rol de la aplicación (gesnoc_app), igual que en producción.
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

afterAll(() => sql.end());

const codigoDeError = async (consulta: Promise<unknown>) => {
  try {
    await consulta;
    return 'sin error';
  } catch (error) {
    return (error as { code?: string }).code;
  }
};

describe('esquema migrado', () => {
  it('tiene las 25 tablas del modelo vigente en el esquema gesnoc', async () => {
    const [fila] = await sql<{ tablas: number }[]>`
      select count(*)::int as tablas from information_schema.tables
      where table_schema = 'gesnoc' and table_type = 'BASE TABLE'`;
    expect(fila?.tablas).toBe(25);
  });

  it('de la historia solo se actualizan las columnas de eventos (RN-09, RN-22, RN-30)', async () => {
    const puedeActualizar = async (tabla: string, columna: string) => {
      const [fila] = await sql<{ puede: boolean }[]>`
        select has_column_privilege(current_user, ${`gesnoc.${tabla}`}, ${columna}, 'UPDATE')
          as puede`;
      return fila!.puede;
    };
    for (const [tabla, columna] of [
      ['detalle_pedido', 'precio_unitario'],
      ['detalle_pedido', 'cantidad'],
      ['pago', 'monto'],
      ['pago', 'medio'],
      ['entrada', 'ticket'],
      ['entrada', 'monto'],
      ['reporte', 'tipo'],
      ['arqueo', 'fondo_inicial'],
    ] as const) {
      expect(await puedeActualizar(tabla, columna), `${tabla}.${columna}`).toBe(false);
    }
    expect(await puedeActualizar('detalle_pedido', 'anulado_en')).toBe(true);
    expect(await puedeActualizar('pago', 'confirmado_en')).toBe(true);
  });

  it('la aplicación no puede cambiar la estructura (ADR-004)', async () => {
    expect(await codigoDeError(sql`create table gesnoc.intrusa (id int)`)).toBe('42501');
  });

  it('la aplicación no puede borrar la historia de dinero ni de la puerta', async () => {
    for (const tabla of [
      'pago',
      'pedido',
      'entrada',
      'sorteo',
      'reporte',
      'llamado',
      'cuenta',
      'detalle_pedido',
      'comanda',
      'arqueo',
    ]) {
      expect(await codigoDeError(sql`delete from ${sql('gesnoc')}.${sql(tabla)}`), tabla).toBe(
        '42501',
      );
    }
  });
});
