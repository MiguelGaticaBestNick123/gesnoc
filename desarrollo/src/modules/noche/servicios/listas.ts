import 'server-only';
import { fechaOperativa } from './noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import { formatearFecha } from '@/shared/utilidades/fechas';
import { formatearDocumento } from '@/shared/utilidades/rut';
import type { DatosIntegrante, DatosLista } from '../esquemas';
import { leerLista } from '../listas';
import * as repositorio from '../repositorios/listas';
import { nocheAnterior, terminada, type Vigencia } from '../vigencia';

// Listas con vigencia (pedido del Product Owner, 18 nov). Una lista vale una noche (un cumpleaños),
// varias (los bailarines de una temporada) o no tiene término (los clientes frecuentes: conocidos
// de la administración y habituales que se ganaron entrar gratis). Se prepara y se edita mientras
// esté vigente; la que ya terminó queda como registro de cómo entró la gente (RN-26).

const restricciones = {
  integrante_pkey: 'Esa persona ya está en la lista',
  integrante_lista_id_fkey: 'Esa lista ya no existe',
  lista_vigencia_ck: 'La lista no puede terminar antes de empezar',
};

const yaTermino = (vigencia: Vigencia) =>
  new ErrorDeNegocio(
    `Esa lista terminó el ${formatearFecha(vigencia.hasta!)}: queda como registro y no cambia`,
  );

/** Las listas con sus personas; con una noche, cada persona trae la hora en que entró esa noche. */
async function conIntegrantes(listas: repositorio.ListaGuardada[], noche: string | null) {
  const personas = await repositorio.integrantesDe(
    listas.map((l) => l.id),
    noche,
  );
  return listas.map((l) => ({
    ...l,
    personas: personas.filter((p) => p.listaId === l.id),
  }));
}

/**
 * Las listas vigentes una noche, para su página: las de esa noche y las de varias o sin término. Una
 * lista que ya terminó no se edita, aunque se vea desde una noche que todavía no se cierra.
 */
export async function listasDeLaNoche(fecha: string, nocheEditable: boolean) {
  const [listas, hoy] = await Promise.all([repositorio.vigentesEn(fecha), fechaOperativa()]);
  return (await conIntegrantes(listas, fecha)).map((l) => ({
    ...l,
    editable: nocheEditable && !terminada(l, hoy),
  }));
}

export type ListaConPersonas = Awaited<ReturnType<typeof listasDeLaNoche>>[number];

/** La pantalla «Listas»: las vigentes y las que vienen, sin depender de una noche. */
export async function pantallaListas(actor: Actor) {
  exigir(actor, 'admin');
  const hoy = await fechaOperativa();
  const listas = await conIntegrantes(await repositorio.vigentesDesde(hoy), null);
  return { hoy, listas: listas.map((l) => ({ ...l, editable: true })) };
}

export type PantallaListas = Awaited<ReturnType<typeof pantallaListas>>;

/**
 * Crea o edita una lista. No empieza en una noche que ya pasó, y si alguien ya entró con ella su
 * vigencia sigue incluyendo esas noches: la entrada guarda con qué lista se la reconoció (HU-33 CA2).
 * Dos listas que comparten alguna noche no se llaman igual: en la puerta se confundirían.
 */
export async function guardarLista(actor: Actor, { id, ...datos }: DatosLista) {
  exigir(actor, 'admin');
  const hoy = await fechaOperativa();
  const empiezaAntes = () =>
    new ErrorDeNegocio('Una lista no puede empezar en una noche que ya pasó');

  await traducir(
    db().transaction(async (tx) => {
      await repositorio.bloquearListas(tx);
      if (id === null) {
        if (datos.desde < hoy) throw empiezaAntes();
      } else {
        const actual = await repositorio.buscarLista(tx, id, true);
        if (!actual) throw new ErrorDeNegocio('Esa lista ya no existe');
        if (terminada(actual, hoy)) throw yaTermino(actual);
        if (datos.desde !== actual.desde && datos.desde < hoy) throw empiezaAntes();
        const { primera, ultima } = await repositorio.usosDe(tx, id);
        const usada = (noche: string) =>
          new ErrorDeNegocio(
            `El ${formatearFecha(noche)} entró gente con esta lista: su vigencia debe incluir esa noche`,
          );
        if (primera && datos.desde > primera) throw usada(primera);
        if (ultima && datos.hasta !== null && datos.hasta < ultima) throw usada(ultima);
      }
      if (await repositorio.nombreOcupado(tx, datos.nombre, datos, id)) {
        throw new ErrorDeNegocio(`Ya hay una lista «${datos.nombre}» en esas noches`);
      }
      if (id === null) await repositorio.insertarLista(tx, datos);
      else await repositorio.actualizarLista(tx, id, datos);
    }),
    restricciones,
  );
}

/**
 * Quita una lista de las que la puerta reconoce. Si nadie entró con ella, se elimina con sus
 * personas. Si alguien entró, queda como registro (HU-33 CA2) y termina la noche anterior a hoy:
 * desde esta noche la puerta ya no la reconoce. Si alguien entró con ella esta misma noche, sigue
 * vigente hasta el cierre.
 */
export async function quitarLista(actor: Actor, id: number) {
  exigir(actor, 'admin');
  const hoy = await fechaOperativa();
  await db().transaction(async (tx) => {
    const actual = await repositorio.buscarLista(tx, id, true);
    if (!actual) return; // otra persona ya la quitó
    if (terminada(actual, hoy)) throw yaTermino(actual);
    const usos = await repositorio.usosDe(tx, id);
    if (usos.entradas === 0) {
      await repositorio.eliminarLista(tx, id);
      return;
    }
    if (usos.ultima! >= hoy) {
      throw new ErrorDeNegocio(
        `${usos.entradas === 1 ? 'Una persona ya entró' : `${usos.entradas} personas ya entraron`} con esta lista esta noche: queda como registro de cómo entraron`,
      );
    }
    await repositorio.actualizarLista(tx, id, { hasta: nocheAnterior(hoy) });
  });
}

/** Una lista que todavía vale, para cambiar sus personas. */
async function exigirListaVigente(listaId: number) {
  const [actual, hoy] = await Promise.all([
    repositorio.buscarLista(db(), listaId),
    fechaOperativa(),
  ]);
  if (!actual) throw new ErrorDeNegocio('Esa lista ya no existe');
  if (terminada(actual, hoy)) throw yaTermino(actual);
}

export async function agregarIntegrante(actor: Actor, datos: DatosIntegrante) {
  exigir(actor, 'admin');
  await exigirListaVigente(datos.listaId);
  await traducir(repositorio.insertarIntegrante(datos), restricciones);
}

/**
 * Carga de una vez la lista que envió quien la organiza. Si una línea no se entiende o alguien ya
 * está en la lista, no se carga nada y se dice qué corregir: una lista a medias se presta a confusión.
 */
export async function pegarIntegrantes(
  actor: Actor,
  listaId: number,
  texto: string,
): Promise<number> {
  exigir(actor, 'admin');
  await exigirListaVigente(listaId);
  const { personas, errores } = leerLista(texto);
  if (errores.length > 0) throw new ErrorDeNegocio(errores.slice(0, 3).join('. '));
  const repetidos = await repositorio.yaEnLaLista(
    listaId,
    personas.map((p) => p.documento),
  );
  if (repetidos.length > 0) {
    throw new ErrorDeNegocio(
      `Ya están en la lista: ${repetidos.map(formatearDocumento).join(', ')}`,
    );
  }
  await traducir(repositorio.insertarIntegrantes(listaId, personas), restricciones);
  return personas.length;
}

/**
 * Saca a una persona de la lista: la puerta deja de reconocerla. Si ya entró con ella, sus entradas
 * conservan con qué lista entró (HU-34 CA2).
 */
export async function quitarIntegrante(actor: Actor, listaId: number, documento: string) {
  exigir(actor, 'admin');
  await exigirListaVigente(listaId);
  await repositorio.quitarIntegrante(listaId, documento);
}
