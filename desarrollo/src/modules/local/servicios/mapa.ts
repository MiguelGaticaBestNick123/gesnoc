import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import type { DatosPlano } from '../esquemas';
import { numerosRepetidos } from '../geometria';
import { listarAmbientes } from '../repositorios/ambientes';
import * as mapa from '../repositorios/mapa';

/**
 * Pedido del Product Owner (19 nov): al empezar el turno, el garzón ordena las mesas de su
 * ambiente (RN-14): las mueve y les cambia el número, las sillas, la forma, el tamaño y el giro.
 * Agregar o retirar mesas sigue en la administración, porque cambia los códigos QR impresos.
 */
function exigirPlano(actor: Actor, ambienteId?: number) {
  if (actor.esAdministrador) return;
  exigir(actor, 'garzon', ambienteId === undefined ? undefined : { ambienteId });
}

/** HU-05: el plano de un ambiente para editarlo, con las mesas que no se pueden retirar. */
export async function planoParaEditar(actor: Actor, ambienteId?: number) {
  exigirPlano(actor);
  const activos = (await listarAmbientes()).filter((a) => a.activo);
  // La administración elige el ambiente; el garzón ordena siempre el de su turno.
  const ambientes = actor.esAdministrador
    ? activos
    : activos.filter((a) => a.id === actor.turno?.ambienteId);
  const ambiente = ambientes.find((a) => a.id === ambienteId) ?? ambientes[0];
  const lista = ambientes.map(({ id, nombre }) => ({ id, nombre }));
  const agregaYRetira = actor.esAdministrador;
  if (!ambiente) {
    const vacio: { mesas: Awaited<ReturnType<typeof mapa.mesasActivas>>; conCuenta: number[] } = {
      mesas: [],
      conCuenta: [],
    };
    return { ambientes: lista, ambiente: null, agregaYRetira, ...vacio };
  }

  const [mesas, conCuenta] = await Promise.all([
    mapa.mesasActivas(ambiente.id),
    mapa.conCuentaAbierta(ambiente.id),
  ]);
  return {
    ambientes: lista,
    ambiente: {
      id: ambiente.id,
      nombre: ambiente.nombre,
      planoAncho: ambiente.planoAncho,
      planoAlto: ambiente.planoAlto,
    },
    agregaYRetira,
    mesas,
    conCuenta,
  };
}

export type PlanoParaEditar = Awaited<ReturnType<typeof planoParaEditar>>;

const unir = (numeros: number[]) => numeros.join(', ');

/**
 * HU-05: guarda el plano del ambiente en una sola transacción. CA2: el número no se repite entre las
 * mesas activas. CA3: retirar o renumerar no toca las cuentas, que apuntan a la mesa por su id.
 */
export async function guardarPlano(actor: Actor, datos: DatosPlano) {
  exigirPlano(actor, datos.ambienteId);
  const agregaORetira = datos.retiradas.length > 0 || datos.mesas.some((m) => m.id === undefined);
  if (agregaORetira && !actor.esAdministrador) {
    throw new ErrorDeNegocio('Agregar o retirar mesas lo hace la administración');
  }
  const repetidos = numerosRepetidos(datos.mesas);
  if (repetidos.length > 0) {
    throw new ErrorDeNegocio(`Hay mesas con el mismo número: ${unir(repetidos)}`);
  }

  await traducir(
    db().transaction(async (tx) => {
      const plano = await mapa.bloquearPlano(tx, datos.ambienteId);
      if (!plano) throw new ErrorDeNegocio('Ese ambiente no existe');

      const ajenas = [
        ...datos.mesas.flatMap((m) => (m.id === undefined ? [] : [m.id])),
        ...datos.retiradas,
      ].filter((id) => !plano.activas.includes(id));
      if (ajenas.length > 0) {
        throw new ErrorDeNegocio('El plano cambió mientras lo editabas: vuelve a cargarlo');
      }
      const fuera = datos.mesas.filter(
        (m) => m.posX + m.ancho > plano.ancho || m.posY + m.alto > plano.alto,
      );
      if (fuera.length > 0) {
        throw new ErrorDeNegocio(
          `La mesa ${unir(fuera.map((m) => m.numero))} quedó fuera del plano`,
        );
      }
      // Retirar una mesa con su cuenta abierta la dejaría invisible y la noche no podría cerrarse.
      const ocupadas = await mapa.numerosConCuentaAbierta(tx, datos.retiradas);
      if (ocupadas.length > 0) {
        throw new ErrorDeNegocio(
          `La mesa ${unir(ocupadas)} tiene una cuenta abierta: no se puede retirar`,
        );
      }
      await mapa.guardarPlano(tx, datos);
    }),
    { mesa_numero_uq: 'Ese número ya lo usa otra mesa activa del ambiente' },
  );
  return mapa.mesasActivas(datos.ambienteId);
}
