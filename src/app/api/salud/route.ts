import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/cliente';

export const dynamic = 'force-dynamic';

// La usan el healthcheck del contenedor y el monitoreo del ambiente de demostración:
// responde 200 solo si la aplicación llega a la base con su propio rol.
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return Response.json({ estado: 'ok' });
  } catch {
    return Response.json({ estado: 'sin base de datos' }, { status: 503 });
  }
}
