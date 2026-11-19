// Chat del personal (pedido del Product Owner, 18 nov): un canal general que ven todos los que
// trabajan la noche y uno por rol. Cada persona lee y escribe en el general y en el de su rol de esa
// noche; la administración, en todos. Lógica pura, sin base.
import type { RolTurno } from '@/shared/autorizacion';

export const CANALES = ['general', 'garzon', 'barman', 'cocinero', 'guardia'] as const;
export type Canal = (typeof CANALES)[number];

export const nombreDelCanal: Record<Canal, string> = {
  general: 'General',
  garzon: 'Garzones',
  barman: 'Barra',
  cocinero: 'Cocina',
  guardia: 'Guardias',
};

interface QuienChatea {
  esAdministrador: boolean;
  turno: { rol: RolTurno } | null;
}

/** Los canales que una persona lee y en los que escribe; sin turno esta noche, ninguno. */
export function canalesDe(actor: QuienChatea): Canal[] {
  if (actor.esAdministrador) return [...CANALES];
  return actor.turno ? ['general', actor.turno.rol] : [];
}

export interface MensajeVisto {
  numero: number;
  canal: Canal;
  autorId: number;
}

/**
 * Cuántos mensajes de otras personas llegaron a cada canal después del último que se vio. Los
 * propios no cuentan: ya se leyeron al escribirlos.
 */
export function noLeidos(
  mensajes: MensajeVisto[],
  vistoHasta: Partial<Record<Canal, number>>,
  yo: number,
): Partial<Record<Canal, number>> {
  const cuenta: Partial<Record<Canal, number>> = {};
  for (const mensaje of mensajes) {
    if (mensaje.autorId === yo || mensaje.numero <= (vistoHasta[mensaje.canal] ?? 0)) continue;
    cuenta[mensaje.canal] = (cuenta[mensaje.canal] ?? 0) + 1;
  }
  return cuenta;
}
