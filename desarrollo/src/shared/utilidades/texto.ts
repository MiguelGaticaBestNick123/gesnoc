/** Iniciales para un avatar: «Diego Soto» da «DS». */
export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
}

/** Una cantidad con su sustantivo concordado: «1 cuenta abierta», «3 cuentas abiertas». */
export function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}
