import postgres from 'postgres';
import { afterAll, beforeEach } from 'vitest';
import { llevaAmbiente, type Actor, type RolTurno } from '@/shared/autorizacion';
import { hashearClave } from '@/shared/sesion/clave';
import { vaciar } from '../../db/seeds/demostracion';

// El migrador es dueño de las tablas: solo él puede vaciar la historia entre pruebas.
const migrador = postgres(process.env.DATABASE_URL_MIGRADOR!, { max: 1, onnotice: () => {} });
afterAll(() => migrador.end());

export const consultar = migrador;

/** Deja la base vacía antes de cada prueba del archivo. */
export const conBaseVacia = () => beforeEach(() => vaciar(migrador));

export const administracion: Actor = {
  id: 0,
  nombre: 'Administración',
  esAdministrador: true,
  turno: null,
};

export const sinTurno = (id = 0): Actor => ({
  id,
  nombre: 'Sin turno',
  esAdministrador: false,
  turno: null,
});

export const conTurno = (rol: RolTurno, id = 0): Actor => ({
  ...sinTurno(id),
  turno: { fecha: '2026-11-06', rol, ambienteId: llevaAmbiente(rol) ? 1 : null },
});

export const CLAVE = 'clave-de-prueba';

export async function crearPersona(correo: string, activo = true): Promise<number> {
  const claveHash = await hashearClave(CLAVE);
  const [fila] = await migrador<{ id: number }[]>`
    insert into gesnoc.usuario (nombre, correo, clave_hash, activo)
    values ('Persona de prueba', ${correo}, ${claveHash}, ${activo}) returning id`;
  return fila!.id;
}
