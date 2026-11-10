// Borrador del pedido en el teléfono (CU-13, flujo 4a): sobrevive a un corte de red y a una recarga.
// La llave lleva la noche y la cuenta, así que un borrador de otra noche no puede reaparecer.

export interface LineaBorrador {
  productoId: number;
  cantidad: number;
  nota: string;
}

export interface Borrador {
  lineas: LineaBorrador[];
  personas: number;
  /** Clave de un envío que no se pudo confirmar. Mientras exista, el pedido no se edita. */
  clave?: string;
}

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const PREFIJO = 'gesnoc:pedido:';
export const BORRADOR_VACIO: Borrador = { lineas: [], personas: 0 };

export const llaveDeBorrador = (fecha: string, cuenta: number) => `${PREFIJO}${fecha}:${cuenta}`;

const esLinea = (valor: unknown): valor is LineaBorrador => {
  const linea = valor as LineaBorrador;
  return (
    Number.isInteger(linea?.productoId) &&
    Number.isInteger(linea?.cantidad) &&
    typeof linea?.nota === 'string'
  );
};

export function leerBorrador(almacen: Almacen, llave: string, fecha: string): Borrador {
  try {
    const deOtraNoche: string[] = [];
    for (let indice = 0; indice < almacen.length; indice++) {
      const otra = almacen.key(indice);
      if (otra?.startsWith(PREFIJO) && !otra.startsWith(`${PREFIJO}${fecha}:`))
        deOtraNoche.push(otra);
    }
    deOtraNoche.forEach((otra) => almacen.removeItem(otra));

    const guardado = JSON.parse(almacen.getItem(llave) ?? 'null') as Partial<Borrador> | null;
    if (!guardado || !Array.isArray(guardado.lineas) || !guardado.lineas.every(esLinea)) {
      return BORRADOR_VACIO;
    }
    return {
      lineas: guardado.lineas,
      personas: Number.isInteger(guardado.personas) ? guardado.personas! : 0,
      clave: typeof guardado.clave === 'string' ? guardado.clave : undefined,
    };
  } catch {
    return BORRADOR_VACIO;
  }
}

export function guardarBorrador(almacen: Almacen, llave: string, borrador: Borrador) {
  try {
    if (borrador.lineas.length === 0 && !borrador.clave) almacen.removeItem(llave);
    else almacen.setItem(llave, JSON.stringify(borrador));
  } catch {
    // Sin almacenamiento (modo privado): el borrador vive solo mientras la pantalla esté abierta.
  }
}

/** Suma una unidad del producto: una línea por producto, con su cantidad y su nota. */
export function agregar(lineas: LineaBorrador[], productoId: number): LineaBorrador[] {
  if (lineas.some((linea) => linea.productoId === productoId)) {
    return lineas.map((linea) =>
      linea.productoId === productoId
        ? { ...linea, cantidad: Math.min(99, linea.cantidad + 1) }
        : linea,
    );
  }
  return [...lineas, { productoId, cantidad: 1, nota: '' }];
}

/** Cambia la cantidad; en cero, la línea sale del pedido. */
export function cambiarCantidad(lineas: LineaBorrador[], productoId: number, delta: number) {
  return lineas
    .map((linea) =>
      linea.productoId === productoId
        ? { ...linea, cantidad: Math.min(99, linea.cantidad + delta) }
        : linea,
    )
    .filter((linea) => linea.cantidad > 0);
}
