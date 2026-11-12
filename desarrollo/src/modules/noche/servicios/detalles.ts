import 'server-only';
import { listarAmbientes } from '@/modules/local/repositorios/ambientes';
import { listarCategorias, listarProductos } from '@/modules/local/repositorios/catalogo';
import { exigir, type Actor } from '@/shared/autorizacion';
import { CLAVE_FORANEA, ErrorDeNegocio, traducir } from '@/shared/errores';
import { formatearDocumento } from '@/shared/utilidades/rut';
import type { DatosInvitacion, DatosLista, DatosPremio } from '../esquemas';
import { leerLista, ordenNocturno } from '../listas';
import * as repositorio from '../repositorios/detalles';
import { buscarNoche, type EstadoNoche } from '../repositorios/noches';

// Detalles de cada noche (pedido del Product Owner, 12 nov): el premio del sorteo de cada ambiente,
// los eventos, las listas y los invitados. Se preparan antes y también con la noche abierta (llegan
// nombres a última hora); una noche cerrada ya no cambia (RN-26).

const restricciones = {
  invitacion_pkey: 'Esa persona ya está invitada esta noche',
  lista_nombre_uq: 'Ya hay una lista con ese nombre esta noche',
  invitacion_lista_fk: 'Esa lista ya no existe',
};

async function exigirNocheVigente(fecha: string) {
  const noche = await buscarNoche(fecha);
  if (!noche) throw new ErrorDeNegocio('Esa noche no existe');
  if (noche.cerradaEn) throw new ErrorDeNegocio('Una noche cerrada no admite cambios'); // RN-26
}

const estadoDe = (noche: { abiertaEn: string | null; cerradaEn: string | null }): EstadoNoche => {
  if (noche.cerradaEn) return 'cerrada';
  return noche.abiertaEn ? 'abierta' : 'programada';
};

/** Todo lo que se prepara para una noche, para su página en el calendario. */
export async function detalleDeNoche(actor: Actor, fecha: string) {
  exigir(actor, 'admin');
  const noche = await buscarNoche(fecha);
  if (!noche) return null;
  const [ambientes, categorias, productos, premios, eventos, listas, invitaciones, sorteos] =
    await Promise.all([
      listarAmbientes(),
      listarCategorias(),
      listarProductos(),
      repositorio.premiosDe(fecha),
      repositorio.eventosDe(fecha),
      repositorio.listasDe(fecha),
      repositorio.invitacionesDe(fecha),
      repositorio.sorteosDe(fecha),
    ]);
  const categoriaDe = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? '';
  return {
    noche: {
      fecha: noche.fecha,
      nota: noche.nota,
      precioEntrada: noche.precioEntrada,
      estado: estadoDe(noche),
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
    listas: listas.map((l) => ({
      ...l,
      personas: invitaciones.filter((i) => i.listaNumero === l.numero),
    })),
    invitados: invitaciones.filter((i) => i.listaNumero === null),
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

export async function guardarLista(actor: Actor, { fecha, numero, ...datos }: DatosLista) {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  if (numero === null) {
    const nueva = await traducir(repositorio.agregarLista(fecha, datos), restricciones);
    if (nueva === null) throw new ErrorDeNegocio('La noche ya tiene 99 listas');
    return;
  }
  const editadas = await traducir(repositorio.editarLista(fecha, numero, datos), restricciones);
  if (editadas.length === 0) throw new ErrorDeNegocio('Esa lista ya no existe');
}

export async function quitarLista(actor: Actor, fecha: string, numero: number) {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  await repositorio.quitarLista(fecha, numero);
}

export async function invitar(actor: Actor, datos: DatosInvitacion) {
  exigir(actor, 'admin');
  await exigirNocheVigente(datos.fecha);
  await traducir(repositorio.insertarInvitacion(datos), restricciones);
}

/**
 * Carga de una vez la lista que envió quien la organiza. Si una línea no se entiende o alguien ya
 * está invitado, no se carga nada y se dice qué corregir: una lista a medias se presta a confusión.
 */
export async function pegarLista(
  actor: Actor,
  fecha: string,
  listaNumero: number,
  texto: string,
): Promise<number> {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  const { personas, errores } = leerLista(texto);
  if (errores.length > 0) throw new ErrorDeNegocio(errores.slice(0, 3).join('. '));
  const repetidos = await repositorio.yaInvitados(
    fecha,
    personas.map((p) => p.documento),
  );
  if (repetidos.length > 0) {
    throw new ErrorDeNegocio(
      `Ya están invitados esta noche: ${repetidos.map(formatearDocumento).join(', ')}`,
    );
  }
  await traducir(repositorio.insertarPersonasDeLista(fecha, listaNumero, personas), restricciones);
  return personas.length;
}

export async function quitarInvitacion(actor: Actor, fecha: string, documento: string) {
  exigir(actor, 'admin');
  await exigirNocheVigente(fecha);
  await repositorio.quitarInvitacion(fecha, documento);
}
