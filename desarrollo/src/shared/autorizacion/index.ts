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

/** Sobre qué se actúa: una cuenta o una estación pertenece a un ambiente. */
export interface Recurso {
  ambienteId: number;
}

const permisoDelTurno: Record<RolTurno, Permiso> = {
  garzon: 'garzon',
  barman: 'barra',
  cocinero: 'cocina',
  guardia: 'guardia',
};

// RF-04 y RN-05: la administración opera siempre, el turno de la noche abierta decide el resto y
// sin turno solo queda el calendario propio. RN-14: sobre un recurso, solo en el ambiente del turno.
export function puede(actor: Actor, permiso: Permiso, recurso?: Recurso): boolean {
  if (actor.esAdministrador || permiso === 'personal') return true;
  if (actor.turno === null || permisoDelTurno[actor.turno.rol] !== permiso) return false;
  return recurso === undefined || recurso.ambienteId === actor.turno.ambienteId;
}

export function exigir(actor: Actor, permiso: Permiso, recurso?: Recurso): void {
  if (!puede(actor, permiso, recurso)) throw new NoAutorizado();
}

export function inicioDe(actor: Actor): string {
  if (actor.esAdministrador) return '/admin';
  return `/${actor.turno ? permisoDelTurno[actor.turno.rol] : 'personal'}`;
}
