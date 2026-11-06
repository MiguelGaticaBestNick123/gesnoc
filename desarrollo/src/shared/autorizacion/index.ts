import { NoAutorizado } from '@/shared/errores';

export type RolTurno = 'garzon' | 'barman' | 'cocinero' | 'guardia';

/** Lo que cada persona puede hacer se reduce a qué pantalla de rol puede operar. */
export type Permiso = 'admin' | 'garzon' | 'barra' | 'cocina' | 'guardia' | 'personal';

export interface Turno {
  fecha: string;
  rol: RolTurno;
  ambienteId: number | null;
}

/** Quién actúa: se arma con la sesión, `es_administrador` y el turno de la noche abierta. */
export interface Actor {
  id: number;
  nombre: string;
  esAdministrador: boolean;
  turno: Turno | null;
}

const permisoDelTurno: Record<RolTurno, Permiso> = {
  garzon: 'garzon',
  barman: 'barra',
  cocinero: 'cocina',
  guardia: 'guardia',
};

// RF-04 y RN-05: la administración opera siempre, el turno de la noche abierta decide el resto y
// sin turno solo queda el calendario propio.
export function puede(actor: Actor, permiso: Permiso): boolean {
  if (actor.esAdministrador || permiso === 'personal') return true;
  return actor.turno !== null && permisoDelTurno[actor.turno.rol] === permiso;
}

export function exigir(actor: Actor, permiso: Permiso): void {
  if (!puede(actor, permiso)) throw new NoAutorizado();
}

export function inicioDe(actor: Actor): string {
  if (actor.esAdministrador) return '/admin';
  return `/${actor.turno ? permisoDelTurno[actor.turno.rol] : 'personal'}`;
}
