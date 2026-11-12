/**
 * Hoja que sube desde abajo en el teléfono y crece solo lo que necesita su contenido. En un Drawer
 * abajo el contenedor es una fila, así que `flex` fija el ancho: queda en 100 %, porque con `auto` la
 * hoja se angostaba al ancho de su contenido.
 */
export const hojaInferior = {
  content: { height: 'auto', maxHeight: '85dvh', flex: '0 0 100%' },
} as const;
