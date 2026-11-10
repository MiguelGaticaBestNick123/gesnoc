export interface ProductoRuteable {
  /** Estación forzada en el producto. */
  estacionId: number | null;
  reglaRuteo: string;
  /** Estación fija de la categoría. */
  estacionCategoria: number | null;
}

/**
 * RN-10: cada ítem va a la estación de su producto; si no tiene, a la estación fija de su categoría,
 * y si la categoría usa «barra del ambiente», a la barra del ambiente de la cuenta. Devuelve `null`
 * cuando ese ambiente no tiene barra: el pedido no se puede enviar (CU-13, flujo 5e).
 *
 * Es la única regla de envío: la usan el pedido y la pantalla que arma el pedido.
 */
export function estacionDestino(
  producto: ProductoRuteable,
  barraDelAmbiente: number | null,
): number | null {
  if (producto.estacionId !== null) return producto.estacionId;
  if (producto.reglaRuteo === 'fija') return producto.estacionCategoria;
  return barraDelAmbiente;
}
