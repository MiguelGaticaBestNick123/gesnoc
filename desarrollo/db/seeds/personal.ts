// Personal del local (pedido del Product Owner, 18 nov): las cuentas con los nombres de quienes
// trabajan, su correo y su rol habitual, que la asignación de turnos usa para recomendar. Las demás
// cuentas se desactivan: no se borran porque la historia de las noches las nombra, pero dejan de
// entrar y de ofrecerse para turnos. La contraseña no está acá: se recibe como parámetro.
import type { Sql } from 'postgres';
import { hashearClave } from '../../src/shared/sesion/clave.ts';

type Rol = 'garzon' | 'barman' | 'cocinero' | 'guardia';

export interface PersonaDelLocal {
  nombre: string;
  correo: string;
  administracion?: boolean;
  /** El rol habitual y, si tiene, el alternativo. */
  roles?: [Rol] | [Rol, Rol];
}

export const personalDelLocal: PersonaDelLocal[] = [
  { nombre: 'Lorena', correo: 'lorena@gesnoc.test', administracion: true },
  { nombre: 'Pato', correo: 'pato@gesnoc.test', roles: ['barman'] },
  { nombre: 'Matías', correo: 'matias@gesnoc.test', roles: ['barman', 'garzon'] },
  { nombre: 'Geo', correo: 'geo@gesnoc.test', roles: ['garzon', 'barman'] },
  { nombre: 'Cote', correo: 'cote@gesnoc.test', roles: ['garzon'] },
  { nombre: 'Scar', correo: 'scar@gesnoc.test', roles: ['garzon'] },
  { nombre: 'Passi', correo: 'passi@gesnoc.test', roles: ['garzon'] },
  { nombre: 'Vary', correo: 'vary@gesnoc.test', roles: ['garzon'] },
  { nombre: 'Nacho', correo: 'nacho@gesnoc.test', roles: ['guardia'] },
  { nombre: 'Ricky', correo: 'ricky@gesnoc.test', roles: ['guardia'] },
  { nombre: 'Macarena', correo: 'macarena@gesnoc.test', roles: ['guardia'] },
];

/**
 * Deja activas solo las cuentas del personal: crea las que faltan con la contraseña dada y, a las
 * que ya existen, les pone el nombre, el rol y el acceso de la lista sin tocar su contraseña (cada
 * persona pudo cambiarla). Desactiva las demás como lo hace la pantalla «Personal»: sin sesiones y
 * sin turnos ni postulaciones en noches que aún no se abren. Todo o nada, en una transacción.
 */
export async function aplicarPersonal(sql: Sql, clave: string, personas = personalDelLocal) {
  const claveHash = await hashearClave(clave);
  return sql.begin(async (tx) => {
    for (const persona of personas) {
      const [habitual = null, alternativo = null] = persona.roles ?? [];
      await tx`
        insert into gesnoc.usuario
          (nombre, correo, clave_hash, es_administrador, rol_habitual, rol_alternativo)
        values (${persona.nombre}, ${persona.correo}, ${claveHash},
                ${persona.administracion ?? false}, ${habitual}, ${alternativo})
        on conflict (correo) do update
          set nombre = excluded.nombre, es_administrador = excluded.es_administrador,
              rol_habitual = excluded.rol_habitual, rol_alternativo = excluded.rol_alternativo,
              activo = true`;
    }
    const correos = personas.map((persona) => persona.correo);
    const desactivadas = await tx<{ id: number; correo: string }[]>`
      update gesnoc.usuario set activo = false
      where activo and correo <> all(${correos}::text[])
      returning id, correo`;
    const ids = desactivadas.map((fila) => fila.id);
    if (ids.length > 0) {
      await tx`delete from gesnoc.sesion where usuario_id = any(${ids}::int[])`;
      await tx`
        delete from gesnoc.asignacion a using gesnoc.noche n
        where a.usuario_id = any(${ids}::int[]) and n.fecha = a.fecha and n.abierta_en is null`;
      await tx`
        delete from gesnoc.disponibilidad d using gesnoc.noche n
        where d.usuario_id = any(${ids}::int[]) and n.fecha = d.fecha and n.abierta_en is null`;
    }
    return { activas: correos, desactivadas: desactivadas.map((fila) => fila.correo).sort() };
  });
}
