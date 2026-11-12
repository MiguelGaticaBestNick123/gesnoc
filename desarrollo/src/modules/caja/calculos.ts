import { formatearPesos } from '@/shared/utilidades/dinero';

const DECENA = 10;

/**
 * Reparte las propinas de un ambiente en partes iguales a la decena (en Chile no circulan monedas de
 * $1 ni de $5): si no alcanza parejo, las primeras personas reciben $10 más y la última, lo que sobre
 * bajo $10. La suma de las partes es exactamente el total.
 */
export function repartir(total: number, personas: number): number[] {
  if (personas <= 0) return [];
  const base = Math.floor(total / personas / DECENA) * DECENA;
  const partes = Array.from({ length: personas }, () => base);
  let resto = total - base * personas;
  for (let i = 0; resto >= DECENA; i++) {
    partes[i % personas]! += DECENA;
    resto -= DECENA;
  }
  partes[personas - 1]! += resto;
  return partes;
}

/** La lista de pendientes en palabras: «2 cuentas abiertas y el arqueo sin contar». */
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}

/** Una diferencia de caja en palabras: «faltan $2.000», «sobran $500» o «cuadra». */
export function describirDiferencia(diferencia: number): string {
  if (diferencia === 0) return 'cuadra';
  return diferencia < 0
    ? `faltan ${formatearPesos(-diferencia)}`
    : `sobran ${formatearPesos(diferencia)}`;
}
