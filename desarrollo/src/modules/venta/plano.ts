const LADO_MINIMO_TOCABLE = 44;

/**
 * El plano está en unidades del modelo y se escala al ancho disponible. Si al achicarlo la mesa más
 * pequeña quedara bajo 44 px (RNF-09), se mantiene ese mínimo y el plano se desplaza de lado.
 */
export function escalaDelPlano(
  anchoDisponible: number,
  planoAncho: number,
  mesas: { ancho: number; alto: number }[],
) {
  if (anchoDisponible <= 0) return 1;
  const ajustada = Math.min(1, anchoDisponible / planoAncho);
  const ladoMenor = Math.min(...mesas.map((mesa) => Math.min(mesa.ancho, mesa.alto)));
  const minima = Number.isFinite(ladoMenor) ? Math.min(1, LADO_MINIMO_TOCABLE / ladoMenor) : 0;
  return Math.max(ajustada, minima);
}
