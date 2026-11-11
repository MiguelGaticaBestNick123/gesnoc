// La noche abierta del local de demostración, compartida por las pruebas de la operación de la noche.
import { randomUUID } from 'node:crypto';
import * as noches from '@/modules/noche/servicios/noches';
import type { DatosPedido } from '@/modules/venta/esquemas';
import type { Actor, RolTurno } from '@/shared/autorizacion';
import { correoDe, sembrar } from '../../db/seeds/demostracion';
import { administracion, CLAVE, consultar } from './apoyo';

export const fecha = '2026-11-07';

export interface Local {
  salon: number;
  terraza: number;
  mesa: (ambiente: number, numero: number) => number;
  producto: (nombre: string) => number;
  persona: (clave: string) => Actor;
}

// El local de demostración con la noche abierta: dos ambientes, sus estaciones y la dotación.
export async function prepararNoche({ abrirNoche = true } = {}): Promise<Local> {
  await sembrar(consultar, CLAVE, fecha);
  if (abrirNoche) await noches.abrir(administracion, fecha, 0);

  const ambientes = await consultar<{ id: number; nombre: string }[]>`
    select id, nombre from gesnoc.ambiente`;
  const mesas = await consultar<{ id: number; ambiente_id: number; numero: number }[]>`
    select id, ambiente_id, numero from gesnoc.mesa`;
  const productos = await consultar<{ id: number; nombre: string }[]>`
    select id, nombre from gesnoc.producto`;
  const personas = await consultar<
    { id: number; correo: string; rol: RolTurno | null; ambiente_id: number | null }[]
  >`
    select u.id, u.correo, a.rol, a.ambiente_id from gesnoc.usuario u
    left join gesnoc.asignacion a on a.usuario_id = u.id and a.fecha = ${fecha}`;

  const idDe = (nombre: string) => ambientes.find((a) => a.nombre === nombre)!.id;
  return {
    salon: idDe('Salón'),
    terraza: idDe('Terraza'),
    mesa: (ambiente, numero) =>
      mesas.find((m) => m.ambiente_id === ambiente && m.numero === numero)!.id,
    producto: (nombre) => productos.find((p) => p.nombre === nombre)!.id,
    persona: (clave) => {
      const fila = personas.find((p) => p.correo === correoDe(clave))!;
      return {
        id: fila.id,
        nombre: clave,
        esAdministrador: clave === 'admin',
        turno:
          abrirNoche && fila.rol ? { fecha, rol: fila.rol, ambienteId: fila.ambiente_id } : null,
      };
    },
  };
}

export const total = async (tabla: string) => {
  const [fila] = await consultar<{ n: number }[]>`
    select count(*)::int as n from ${consultar('gesnoc')}.${consultar(tabla)}`;
  return fila!.n;
};

export const pedido = (
  cuenta: number,
  lineas: DatosPedido['lineas'],
  personas: number | null = null,
) => ({
  cuenta,
  claveEnvio: randomUUID(),
  personas,
  lineas,
});

export const linea = (productoId: number, cantidad = 1, nota: string | null = null) => ({
  productoId,
  cantidad,
  nota,
});
