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
  it('tiene las 22 tablas del modelo vigente en el esquema gesnoc', async () => {
    const [fila] = await sql<{ tablas: number }[]>`
      select count(*)::int as tablas from information_schema.tables
      where table_schema = 'gesnoc' and table_type = 'BASE TABLE'`;
    expect(fila?.tablas).toBe(22);
  });

  it('la aplicación no puede cambiar la estructura (ADR-004)', async () => {
    expect(await codigoDeError(sql`create table gesnoc.intrusa (id int)`)).toBe('42501');
  });

  it('la aplicación no puede borrar la historia de dinero ni de la puerta', async () => {
    for (const tabla of ['pago', 'pedido', 'entrada', 'sorteo', 'reporte', 'llamado']) {
      expect(await codigoDeError(sql`delete from ${sql('gesnoc')}.${sql(tabla)}`), tabla).toBe(
        '42501',
      );
    }
  });
});
