// Notas de cada ítem del pedido: atajos para lo más común y alergias que la estación no puede pasar
// por alto. La nota sigue siendo texto libre (RF-17): los atajos solo la escriben.

/** El largo máximo de la nota en la base (`detalle_pedido.nota`). */
export const LARGO_NOTA = 140;

export const NOTAS_RAPIDAS = ['Sin hielo', 'Doble', 'Sin azúcar', 'Bien helado', 'Sin cebolla'];

export const ALERGIAS = ['maní', 'gluten', 'lactosa', 'mariscos'];

const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Agrega un atajo a la nota, separado por coma, sin repetirlo y sin pasar el largo máximo. */
export function agregarANota(nota: string, texto: string): string {
  const actual = nota.trim();
  const partes = actual ? actual.split(',').map((p) => normalizar(p.trim())) : [];
  if (partes.includes(normalizar(texto))) return nota;
  const nueva = actual ? `${actual}, ${texto}` : texto;
  return nueva.length > LARGO_NOTA ? nota : nueva;
}

/** La nota menciona una alergia: en la estación se muestra en rojo, como en el papel de antes. */
export const esAlergia = (nota: string | null | undefined) =>
  Boolean(nota) && /alerg|celiac/.test(normalizar(nota!));
