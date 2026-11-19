import 'server-only';
import { listasDeLaNoche } from './listas';
import { exigirNocheVigente } from './noches';
import { listarAmbientes } from '@/modules/local/repositorios/ambientes';
import { listarCategorias, listarProductos } from '@/modules/local/repositorios/catalogo';
import { exigir, type Actor } from '@/shared/autorizacion';
import { CLAVE_FORANEA, ErrorDeNegocio, traducir } from '@/shared/errores';
import type { DatosInvitacion, DatosPremio } from '../esquemas';
import { ordenNocturno } from '../listas';
import * as repositorio from '../repositorios/detalles';
import { buscarNoche, type EstadoNoche } from '../repositorios/noches';

// Detalles de cada noche (pedido del Product Owner, 12 nov): el premio del sorteo de cada ambiente,
// los eventos, las listas vigentes y los invitados. Se preparan antes y también con la noche abierta
// (llegan nombres a última hora); una noche cerrada ya no cambia (RN-26). Las listas tienen su
// propia vigencia (18 nov) y se administran en `servicios/listas.ts`.

const restricciones = {
  invitacion_pkey: 'Esa persona ya está invitada esta noche',
};

const estadoDe = (noche: { abiertaEn: string | null; cerradaEn: string | null }): EstadoNoche => {
  if (noche.cerradaEn) return 'cerrada';
  return noche.abiertaEn ? 'abierta' : 'programada';
};

/** Todo lo que se prepara para una noche, para su página en el calendario. */
export async function detalleDeNoche(actor: Actor, fecha: string) {
  exigir(actor, 'admin');
  const noche = await buscarNoche(fecha);
  if (!noche) return null;
  const estado = estadoDe(noche);
  const [ambientes, categorias, productos, premios, eventos, listas, invitados, sorteos] =
    await Promise.all([
      listarAmbientes(),
      listarCategorias(),
      listarProductos(),
      repositorio.premiosDe(fecha),
      repositorio.eventosDe(fecha),
      listasDeLaNoche(fecha, estado !== 'cerrada'),
      repositorio.invitacionesDe(fecha),
      repositorio.sorteosDe(fecha),
    ]);
  const categoriaDe = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? '';
  return {
    noche: {
      fecha: noche.fecha,
      nota: noche.nota,
      precioEntrada: noche.precioEntrada,
      estado,
    },
    ambientes: ambientes.filter((a) => a.activo).map(({ id, nombre }) => ({ id, nombre })),
    // Para elegir el premio: los productos que se venden, con su categoría.
    productos: productos
      .filter((p) => p.activo)
      .map((p) => ({ id: p.id, nombre: p.nombre, categoria: categoriaDe(p.categoriaId) })),
    premios,
    // Un ambiente que ya sorteó conserva su premio como se sorteó.
    sorteos,
    eventos: eventos.toSorted((a, b) => ordenNocturno(a.hora) - ordenNocturno(b.hora)),
    listas,
    invitados,
  };
}

export type DetalleDeNoche = NonNullable<Awaited<ReturnType<typeof detalleDeNoche>>>;

export async function elegirPremio(actor: Actor, datos: DatosPremio) {
  exigir(actor, 'admin');
  await exigirNocheVigente(datos.fecha);
  if (await repositorio.sorteoHecho(datos.fecha, datos.ambienteId)) {
    throw new ErrorDeNegocio('Ese ambiente ya sorteó su premio esta noche');
  }
  await traducir(repositorio.reemplazarPremio(datos.fecha, datos.ambienteId, datos.items), {
    [CLAVE_FORANEA]: 'El producto o el ambiente ya no existe',
  });
}

export async function agregarEvento(
  actor: Actor,
  fecha: string,
  nombre: string,
  hora: string | null,
) {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  if ((await repositorio.agregarEvento(fecha, nombre, hora)) === null) {
    throw new ErrorDeNegocio('La noche ya tiene 50 eventos');
  }
}

export async function quitarEvento(actor: Actor, fecha: string, numero: number) {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  await repositorio.quitarEvento(fecha, numero);
}

/** Una persona invitada esa noche por alguien (el DJ, la administración), con o sin entrada gratis. */
export async function invitar(actor: Actor, datos: DatosInvitacion) {
  exigir(actor, 'admin');
  await exigirNocheVigente(datos.fecha);
  await traducir(repositorio.insertarInvitacion(datos), restricciones);
}

export async function quitarInvitacion(actor: Actor, fecha: string, documento: string) {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  if ((await repositorio.yaEntro(fecha, documento)) > 0) {
    throw new ErrorDeNegocio(
      'Esta persona ya entró esta noche: su invitación queda como registro de cómo entró',
    );
  }
  await repositorio.quitarInvitacion(fecha, documento);
}
