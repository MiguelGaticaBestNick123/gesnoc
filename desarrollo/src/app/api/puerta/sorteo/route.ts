import { z } from 'zod';
import { sortear } from '@/modules/porteria/servicios/sorteo';
import { leerJson, operar } from '@/shared/rutas';

const datosSorteo = z.object({ ambienteId: z.number().int().positive('Ambiente no válido') });

// HU-37: sortear el premio de un ambiente. Un reintento devuelve el mismo ganador (RN-23).
export async function POST(peticion: Request) {
  return operar(async (actor) =>
    sortear(actor, datosSorteo.parse(await leerJson(peticion)).ambienteId),
  );
}
