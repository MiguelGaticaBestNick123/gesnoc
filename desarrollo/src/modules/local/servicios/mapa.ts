import 'server-only';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import type { DatosPlano } from '../esquemas';
import { numerosRepetidos } from '../geometria';
import { listarAmbientes } from '../repositorios/ambientes';
import * as mapa from '../repositorios/mapa';

/** HU-05: el plano de un ambiente para editarlo, con las mesas que no se pueden retirar. */
export async function planoParaEditar(actor: Actor, ambienteId?: number) {
  exigir(actor, 'admin');
  const ambientes = (await listarAmbientes()).filter((a) => a.activo);
  const ambiente = ambientes.find((a) => a.id === ambienteId) ?? ambientes[0];
  const lista = ambientes.map(({ id, nombre }) => ({ id, nombre }));
  if (!ambiente) {
    const vacio: { mesas: Awaited<ReturnType<typeof mapa.mesasActivas>>; conCuenta: number[] } = {
      mesas: [],
      conCuenta: [],
    };
    return { ambientes: lista, ambiente: null, ...vacio };
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
  exigir(actor, 'admin');
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
