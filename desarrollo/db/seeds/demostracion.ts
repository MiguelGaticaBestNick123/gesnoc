// Local de demostración, con personas y datos ficticios. Las contraseñas no están acá: se reciben
// como parámetro. Deja las noches programadas, sin abrir, para recorrer el flujo completo desde la
// administración.
import { randomBytes } from 'node:crypto';
import type { Sql, TransactionSql } from 'postgres';
import { hashearClave } from '../../src/shared/sesion/clave.ts';

const personas = [
  { clave: 'admin', nombre: 'Carla Muñoz', admin: true },
  { clave: 'garzon', nombre: 'Diego Soto' },
  { clave: 'garzon2', nombre: 'Paula Vera' },
  { clave: 'barra', nombre: 'Tomás Reyes' },
  { clave: 'barra2', nombre: 'Matías Fuentes' },
  { clave: 'cocina', nombre: 'Inés Castro' },
  { clave: 'guardia', nombre: 'Bruno Pérez' },
  { clave: 'sinturno', nombre: 'Lucía Díaz' },
  { clave: 'apoyo', nombre: 'Rocío Paredes' },
];

export const correoDe = (clave: string) => `${clave}@gesnoc.test`;

type Forma = 'rectangular' | 'redonda';
type Mesa = [numero: number, forma: Forma, x: number, y: number, ancho: number, alto: number];

const ambientes: { nombre: string; ancho: number; alto: number; mesas: Mesa[] }[] = [
  {
    nombre: 'Salón',
    ancho: 900,
    alto: 440,
    mesas: [
      [1, 'rectangular', 40, 40, 110, 80],
      [2, 'rectangular', 200, 40, 110, 80],
      [3, 'rectangular', 360, 40, 110, 80],
      [4, 'rectangular', 520, 40, 110, 80],
      [5, 'rectangular', 680, 40, 110, 80],
      [6, 'rectangular', 40, 180, 180, 90],
      [7, 'redonda', 300, 170, 110, 110],
      [8, 'rectangular', 480, 180, 150, 90],
      [9, 'rectangular', 700, 180, 110, 80],
      [10, 'rectangular', 40, 320, 110, 80],
      [11, 'rectangular', 260, 320, 180, 80],
      [12, 'rectangular', 620, 320, 110, 80],
    ],
  },
  {
    nombre: 'Terraza',
    ancho: 900,
    alto: 300,
    mesas: [
      [1, 'redonda', 60, 50, 100, 100],
      [2, 'redonda', 260, 50, 100, 100],
      [3, 'redonda', 460, 50, 100, 100],
    ],
  },
];

const catalogo: { categoria: string; productos: [nombre: string, precio: number][] }[] = [
  {
    categoria: 'Cervezas',
    productos: [
      ['Schop', 3500],
      ['Cerveza en botella', 4000],
    ],
  },
  {
    categoria: 'Tragos',
    productos: [
      ['Piscola', 6000],
      ['Mojito', 6500],
      ['Pisco sour', 5500],
    ],
  },
  {
    categoria: 'Bebidas',
    productos: [
      ['Bebida', 2500],
      ['Agua mineral', 2000],
      ['Jugo de maracuyá', 3000],
    ],
  },
  {
    categoria: 'Comida',
    productos: [
      ['Papas fritas', 6500],
      ['Tabla mixta', 14900],
    ],
  },
];

export function hoyEnChile(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

function sumarDias(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

async function crearAmbiente(tx: TransactionSql, ambiente: (typeof ambientes)[number]) {
  const [fila] = await tx<{ id: number }[]>`
    insert into gesnoc.ambiente (nombre, plano_ancho, plano_alto)
    values (${ambiente.nombre}, ${ambiente.ancho}, ${ambiente.alto}) returning id`;
  for (const [numero, forma, x, y, ancho, alto] of ambiente.mesas) {
    await tx`
      insert into gesnoc.mesa (ambiente_id, numero, forma, pos_x, pos_y, ancho, alto, token_qr)
      values (${fila!.id}, ${numero}, ${forma}, ${x}, ${y}, ${ancho}, ${alto},
              ${randomBytes(16).toString('base64url')})`;
  }
  return fila!.id;
}

async function crearEstacion(tx: TransactionSql, ambiente: number, nombre: string, tipo: string) {
  const [fila] = await tx<{ id: number }[]>`
    insert into gesnoc.estacion (ambiente_id, nombre, tipo)
    values (${ambiente}, ${nombre}, ${tipo}) returning id`;
  return fila!.id;
}

async function crearCatalogo(tx: TransactionSql, cocina: number) {
  for (const { categoria, productos } of catalogo) {
    const estacion = categoria === 'Comida' ? cocina : null;
    const regla = estacion ? 'fija' : 'barra_ambiente';
    const [fila] = await tx<{ id: number }[]>`
      insert into gesnoc.categoria (nombre, regla_ruteo, estacion_id)
      values (${categoria}, ${regla}, ${estacion}) returning id`;
    for (const [nombre, precio] of productos) {
      await tx`
        insert into gesnoc.producto (categoria_id, nombre, precio)
        values (${fila!.id}, ${nombre}, ${precio})`;
    }
  }
}

async function crearPersona(tx: TransactionSql, persona: (typeof personas)[number], hash: string) {
  const [fila] = await tx<{ id: number }[]>`
    insert into gesnoc.usuario (nombre, correo, clave_hash, es_administrador)
    values (${persona.nombre}, ${correoDe(persona.clave)}, ${hash}, ${persona.admin ?? false})
    returning id`;
  return fila!.id;
}

/** Vacía todas las tablas: el vaciado se propaga por las claves foráneas. Solo el dueño puede. */
export const vaciar = (sql: Sql) => sql`
  truncate gesnoc.usuario, gesnoc.ambiente, gesnoc.noche, gesnoc.cliente, gesnoc.invitado
  restart identity cascade`;

/** Siembra una base vacía; si ya tiene personal no toca nada y devuelve false. */
export async function sembrar(sql: Sql, clave: string, hoy = hoyEnChile()): Promise<boolean> {
  const [fila] = await sql<{ total: number }[]>`
    select count(*)::int as total from gesnoc.usuario`;
  if (fila!.total > 0) return false;

  const hash = await hashearClave(clave);
  await sql.begin(async (tx) => {
    const salon = await crearAmbiente(tx, ambientes[0]!);
    const terraza = await crearAmbiente(tx, ambientes[1]!);
    await crearEstacion(tx, salon, 'Barra Salón', 'barra');
    await crearEstacion(tx, terraza, 'Barra Terraza', 'barra');
    await crearCatalogo(tx, await crearEstacion(tx, salon, 'Cocina', 'cocina'));

    const id: Record<string, number> = {};
    for (const persona of personas) id[persona.clave] = await crearPersona(tx, persona, hash);

    const proxima = sumarDias(hoy, 7);
    await tx`
      insert into gesnoc.noche (fecha, nota, precio_entrada)
      values (${hoy}, 'Noche de demostración', 5000),
             (${sumarDias(hoy, 1)}, null, 5000),
             (${proxima}, 'Entrada gratis hasta las 00:00', 7000)`;

    const dotacion = [
      ['garzon', 'garzon', salon],
      ['garzon2', 'garzon', terraza],
      ['barra', 'barman', salon],
      ['barra2', 'barman', terraza],
      ['cocina', 'cocinero', salon],
      ['guardia', 'guardia', null],
    ] as const;
    for (const [clavePersona, rol, ambiente] of dotacion) {
      const usuario = id[clavePersona]!;
      await tx`insert into gesnoc.disponibilidad (fecha, usuario_id) values (${hoy}, ${usuario})`;
      await tx`
        insert into gesnoc.asignacion (fecha, usuario_id, rol, ambiente_id)
        values (${hoy}, ${usuario}, ${rol}, ${ambiente})`;
    }
    for (const clavePersona of ['garzon', 'sinturno']) {
      await tx`
        insert into gesnoc.disponibilidad (fecha, usuario_id)
        values (${proxima}, ${id[clavePersona]!})`;
    }
  });
  return true;
}
