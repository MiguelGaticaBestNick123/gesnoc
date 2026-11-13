import 'server-only';
import { fechaAbierta } from '@/modules/noche/repositorios/noches';
import { enLaNoche } from '@/modules/noche/servicios/noches';
import { exigir, type Actor } from '@/shared/autorizacion';
import { db } from '@/shared/db/cliente';
import { ErrorDeNegocio, traducir } from '@/shared/errores';
import type { DatosReporte } from '../esquemas';
import { formaDe } from '../formas';
import * as clientes from '../repositorios/clientes';
import * as puerta from '../repositorios/puerta';

// Los reportes y el historial de los clientes (HU-35 y HU-36). RN-25: los datos de los clientes
// solo los ven el guardia y la administración; RN-30: un reporte no se edita ni se borra (la
// aplicación no tiene cómo: no hay servicio de edición, y la base niega DELETE a `gesnoc_app`).

/**
 * HU-36 CA1: las noches en que entró el cliente y sus reportes, del más reciente al más antiguo.
 * Un documento sin registro devuelve `cliente: null`: nunca pasó por la puerta.
 */
export async function historial(actor: Actor, documento: string) {
  exigir(actor, 'guardia');
  const [cliente, fecha] = await Promise.all([
    puerta.clientePorDocumento(db(), documento),
    fechaAbierta(),
  ]);
  const nocheAbierta = Boolean(fecha);
  if (!cliente) return { documento, cliente: null, visitas: [], reportes: [], nocheAbierta };

  const [visitas, reportes] = await Promise.all([
    clientes.visitasDe(cliente.id),
    clientes.reportesDe(cliente.id),
  ]);
  return {
    documento,
    cliente: { nombre: cliente.nombre, apellido: cliente.apellido },
    visitas: visitas.map(({ medio, ...visita }) => ({ ...visita, forma: formaDe(medio) })),
    reportes,
    nocheAbierta,
  };
}

export type Historial = Awaited<ReturnType<typeof historial>>;

/**
 * HU-35: el guardia (o la administración) reporta a un cliente, por ejemplo «comenzó a buscar
 * pelea». CA1 (RN-30): queda con tipo, descripción, autor, noche y hora. Solo durante una noche
 * abierta, porque el reporte pertenece a una noche, y solo de un cliente que ya pasó por la puerta.
 */
export async function reportar(actor: Actor, datos: DatosReporte) {
  exigir(actor, 'guardia');
  return traducir(
    enLaNoche(async (tx, fecha) => {
      const cliente = await puerta.clientePorDocumento(tx, datos.documento);
      if (!cliente) {
        throw new ErrorDeNegocio(
          'Ese documento no tiene registro: solo se reporta a quien pasó por la puerta',
        );
      }
      await clientes.bloquearCliente(tx, cliente.id);
      const numero = await clientes.insertarReporte(tx, {
        clienteId: cliente.id,
        fecha,
        tipo: datos.tipo,
        descripcion: datos.descripcion,
        registradoPor: actor.id,
      });
      return { numero };
    }),
    { reporte_numero_check: 'El cliente llegó al máximo de reportes que se pueden guardar' },
  );
}
