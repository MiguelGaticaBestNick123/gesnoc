// Lógica pura de los reportes de clientes (HU-35 y HU-36).

/** HU-35 CA1: los tipos de reporte, los mismos que acepta la base (`reporte_tipo_check`). */
export const TIPOS_DE_REPORTE = ['advertencia', 'expulsion', 'observacion'] as const;
export type TipoReporte = (typeof TIPOS_DE_REPORTE)[number];

export const tiposDeReporte: Record<TipoReporte, { nombre: string; color: string }> = {
  advertencia: { nombre: 'Advertencia', color: 'yellow' },
  expulsion: { nombre: 'Expulsión', color: 'red' },
  observacion: { nombre: 'Observación', color: 'gray' },
};

/**
 * Lo que la puerta muestra de los reportes al buscar al cliente (HU-36 CA2): cuántos tiene y el más
 * reciente. Si alguno es una expulsión, el aviso va en rojo aunque no sea el último.
 */
export function resumenDeReportes<R extends { tipo: TipoReporte }>(reportes: R[]) {
  return {
    total: reportes.length,
    ultimo: reportes[0] ?? null,
    expulsado: reportes.some((r) => r.tipo === 'expulsion'),
  };
}
