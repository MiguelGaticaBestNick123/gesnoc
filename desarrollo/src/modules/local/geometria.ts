// Geometría del plano de mesas, en unidades del plano del ambiente (RF-06). La comparten el mapa del
// garzón y el editor de la administración. Lógica pura, sin interfaz.

export type FormaMesa = 'cuadrada' | 'redonda' | 'rectangular';

export interface Mesa {
  id: number;
  numero: number;
  forma: FormaMesa;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  rotacion: number;
}

export interface Rectangulo {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Grados; la silla mira hacia la mesa. */
  rotacion: number;
}

/** Margen alrededor del plano: las sillas de una mesa pegada al borde no quedan cortadas. */
export const MARGEN = 32;
/** Paso de la grilla al mover o redimensionar en el editor. */
export const PASO = 10;
export const TAMANO_MINIMO = 20;
export const TAMANO_MAXIMO = 400;
/** RNF-09: el área que responde al dedo mide al menos 44 px en la pantalla. */
export const TOQUE_MINIMO_PX = 44;

const SILLA_LARGO = 24;
const SILLA_ANCHO = 12;
const SEPARACION = 5;

const repartir = (largo: number, cantidad: number) =>
  Array.from({ length: cantidad }, (_, i) => -largo / 2 + (i + 0.5) * (largo / cantidad));

/**
 * Sillas alrededor de una mesa, con el centro de la mesa en el origen. Una mesa larga lleva más sillas
 * por lado; una redonda, sillas repartidas en el círculo según su tamaño.
 */
export function sillasDe({
  forma,
  ancho,
  alto,
}: Pick<Mesa, 'forma' | 'ancho' | 'alto'>): Rectangulo[] {
  if (forma === 'redonda') {
    const radio = ancho / 2 + SEPARACION + SILLA_ANCHO / 2;
    const cantidad = Math.min(10, Math.max(4, Math.round((2 * Math.PI * (ancho / 2)) / 42)));
    return Array.from({ length: cantidad }, (_, i) => {
      const angulo = (2 * Math.PI * i) / cantidad - Math.PI / 2;
      return {
        x: Math.cos(angulo) * radio - SILLA_LARGO / 2,
        y: Math.sin(angulo) * radio - SILLA_ANCHO / 2,
        ancho: SILLA_LARGO,
        alto: SILLA_ANCHO,
        rotacion: (angulo * 180) / Math.PI + 90,
      };
    });
  }

  const porLadoLargo = Math.max(1, Math.floor(ancho / 48));
  const porLadoCorto = alto >= 40 ? Math.max(1, Math.floor(alto / 56)) : 0;
  const sillas: Rectangulo[] = [];
  for (const x of repartir(ancho, porLadoLargo)) {
    const base = { x: x - SILLA_LARGO / 2, ancho: SILLA_LARGO, alto: SILLA_ANCHO, rotacion: 0 };
    sillas.push({ ...base, y: -alto / 2 - SEPARACION - SILLA_ANCHO });
    sillas.push({ ...base, y: alto / 2 + SEPARACION });
  }
  for (const y of repartir(alto, porLadoCorto)) {
    const base = { y: y - SILLA_LARGO / 2, ancho: SILLA_ANCHO, alto: SILLA_LARGO, rotacion: 0 };
    sillas.push({ ...base, x: -ancho / 2 - SEPARACION - SILLA_ANCHO });
    sillas.push({ ...base, x: ancho / 2 + SEPARACION });
  }
  return sillas;
}

/**
 * Escala que hace caber el plano completo (con su margen) en el espacio disponible. Sin alto
 * disponible se ajusta solo al ancho, como en una columna que se desplaza hacia abajo.
 */
export function escalaParaAjustar(
  plano: { ancho: number; alto: number },
  disponible: { ancho: number; alto?: number },
): number {
  if (disponible.ancho <= 0) return 1;
  const porAncho = disponible.ancho / (plano.ancho + 2 * MARGEN);
  if (!disponible.alto || disponible.alto <= 0) return porAncho;
  return Math.min(porAncho, disponible.alto / (plano.alto + 2 * MARGEN));
}

/** Lado del área de toque en unidades del plano: nunca menos de 44 px en la pantalla. */
export const ladoDeToque = (escala: number) => TOQUE_MINIMO_PX / Math.max(escala, 0.01);

export const aLaRejilla = (valor: number, paso = PASO) => Math.round(valor / paso) * paso;

const entre = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

/** Mueve la mesa al punto pedido, ajustado a la grilla y sin salir del plano. */
export function mover<T extends Mesa>(
  mesa: T,
  posX: number,
  posY: number,
  plano: { ancho: number; alto: number },
): T {
  return {
    ...mesa,
    posX: entre(aLaRejilla(posX), 0, Math.max(0, plano.ancho - mesa.ancho)),
    posY: entre(aLaRejilla(posY), 0, Math.max(0, plano.alto - mesa.alto)),
  };
}

/**
 * Cambia el tamaño respetando la forma: una mesa cuadrada o redonda tiene ancho y alto iguales (lo
 * exige la base, `mesa_proporcion_ck`), y ningún lado sale del rango de 20 a 400.
 */
export function redimensionar<T extends Mesa>(mesa: T, ancho: number, alto: number): T {
  const nuevoAncho = entre(aLaRejilla(ancho), TAMANO_MINIMO, TAMANO_MAXIMO);
  const nuevoAlto = entre(aLaRejilla(alto), TAMANO_MINIMO, TAMANO_MAXIMO);
  if (mesa.forma === 'rectangular') return { ...mesa, ancho: nuevoAncho, alto: nuevoAlto };
  const lado = Math.max(nuevoAncho, nuevoAlto);
  return { ...mesa, ancho: lado, alto: lado };
}

/** Al cambiar la forma, una mesa cuadrada o redonda toma el lado mayor que tenía. */
export function cambiarForma<T extends Mesa>(mesa: T, forma: FormaMesa): T {
  return redimensionar({ ...mesa, forma }, mesa.ancho, mesa.alto);
}

/** Números que se repiten entre las mesas del plano (RF-06: no se repiten entre las activas). */
export function numerosRepetidos(mesas: Pick<Mesa, 'numero'>[]): number[] {
  const vistos = new Map<number, number>();
  for (const { numero } of mesas) vistos.set(numero, (vistos.get(numero) ?? 0) + 1);
  return [...vistos].filter(([, veces]) => veces > 1).map(([numero]) => numero);
}

/** El siguiente número libre para una mesa nueva. */
export const siguienteNumero = (mesas: Pick<Mesa, 'numero'>[]) =>
  mesas.reduce((mayor, mesa) => Math.max(mayor, mesa.numero), 0) + 1;

/**
 * Primer lugar libre del plano para una mesa nueva, de arriba abajo y de izquierda a derecha,
 * dejando espacio para las sillas. Si no cabe en ninguna parte, la esquina.
 */
export function lugarLibre(
  mesas: Pick<Mesa, 'posX' | 'posY' | 'ancho' | 'alto'>[],
  plano: { ancho: number; alto: number },
  ancho: number,
  alto: number,
): { posX: number; posY: number } {
  const holgura = 30;
  for (let y = 20; y + alto <= plano.alto; y += 20) {
    for (let x = 20; x + ancho <= plano.ancho; x += 20) {
      const choca = mesas.some(
        (m) =>
          x < m.posX + m.ancho + holgura &&
          x + ancho + holgura > m.posX &&
          y < m.posY + m.alto + holgura &&
          y + alto + holgura > m.posY,
      );
      if (!choca) return { posX: x, posY: y };
    }
  }
  return { posX: 0, posY: 0 };
}
