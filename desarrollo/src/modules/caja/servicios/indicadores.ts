import 'server-only';
import { formaDe, FORMAS_DE_ENTRADA } from '@/modules/porteria/formas';
import { exigir, type Actor } from '@/shared/autorizacion';
import { completarHoras } from '../indicadores';
import { nochesConVentas } from '../repositorios/caja';
import * as indicadores from '../repositorios/indicadores';

/**
 * El panel de indicadores de una noche (la elegida o la más reciente), para la administración. Se
 * calcula siempre desde lo registrado (ADR-011: estado derivado), así que sirve igual con la noche
 * abierta, en vivo, que al día siguiente para comparar noches.
 */
export async function indicadoresDeLaNoche(actor: Actor, fecha?: string) {
  exigir(actor, 'admin');
  const noches = await nochesConVentas();
  const elegida = noches.find((n) => n.fecha === fecha) ?? noches[0] ?? null;
  if (!elegida) return { noches, elegida: null, detalle: null };

  const [ventas, ingresos, medios, preparacion, llamados, cuentas, porGarzon, porCategoria] =
    await Promise.all([
      indicadores.ventasPorHora(elegida.fecha),
      indicadores.ingresosPorHora(elegida.fecha),
      indicadores.ingresosPorMedio(elegida.fecha),
      indicadores.preparacionPorEstacion(elegida.fecha),
      indicadores.llamados(elegida.fecha),
      indicadores.cuentas(elegida.fecha),
      indicadores.ventasPorGarzon(elegida.fecha),
      indicadores.ventasPorCategoria(elegida.fecha),
    ]);

  const porForma = Object.fromEntries(FORMAS_DE_ENTRADA.map((forma) => [forma, 0])) as Record<
    (typeof FORMAS_DE_ENTRADA)[number],
    number
  >;
  for (const { medio, total } of medios) porForma[formaDe(medio)] += total;

  return {
    noches,
    elegida,
    detalle: {
      ventasPorHora: completarHoras(ventas),
      ingresosPorHora: completarHoras(ingresos),
      ingresosPorForma: porForma,
      ingresos: Object.values(porForma).reduce((a, b) => a + b, 0),
      preparacion,
      llamados,
      porGarzon,
      porCategoria,
      cuentas: {
        total: cuentas.cuentas,
        vendido: cuentas.vendido,
        ticketPromedio: cuentas.ticket_promedio,
        duracionMediana: cuentas.duracion_mediana,
      },
    },
  };
}

export type IndicadoresDeLaNoche = Awaited<ReturnType<typeof indicadoresDeLaNoche>>;
