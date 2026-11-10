/**
 * Texto normalizado para buscar: minúsculas y sin tildes. De noche y apurado nadie escribe
 * «maracuyá» con tilde. Se aplica a los dos lados de la comparación. La ñ también se vuelve n, que
 * es lo que se quiere al buscar productos; no sirve para ordenar ni para comparar identidades.
 */
export function paraBuscar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
