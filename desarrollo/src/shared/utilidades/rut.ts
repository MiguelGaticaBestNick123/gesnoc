// RN-21: el documento se valida y se normaliza antes de buscar o registrar a una persona, para que
// la misma persona no quede dos veces. El RUT se guarda sin puntos, con guion y la K en mayúscula; un
// documento extranjero, en mayúsculas y sin espacios ni signos. Quien registra elige el tipo: no se
// adivina, porque un pasaporte de solo números puede parecer un RUT válido.

export type TipoDocumento = 'rut' | 'extranjero';

/** Dígito verificador del cuerpo de un RUT: módulo 11 con factores 2 a 7. */
export function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/** «12.345.678-5», «12345678-5» o «123456785» dan «12345678-5»; si no es un RUT válido, `null`. */
export function normalizarRut(texto: string): string | null {
  const limpio = texto
    .toUpperCase()
    .replace(/[^0-9K]/g, '')
    .replace(/^0+/, '');
  if (!/^\d{6,8}[0-9K]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1);
  const verificador = limpio.slice(-1);
  if (digitoVerificador(cuerpo) !== verificador) return null;
  return `${cuerpo}-${verificador}`;
}

/** Pasaporte o documento extranjero: de 4 a 15 letras y números, en mayúsculas. */
export function normalizarExtranjero(texto: string): string | null {
  const limpio = texto.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^[0-9A-Z]{4,15}$/.test(limpio) ? limpio : null;
}

export function normalizarDocumento(tipo: TipoDocumento, texto: string): string | null {
  return tipo === 'rut' ? normalizarRut(texto) : normalizarExtranjero(texto);
}

/** Para mostrar: el RUT con puntos («12.345.678-5»); un documento extranjero, tal cual. */
export function formatearDocumento(documento: string): string {
  const [cuerpo, verificador] = documento.split('-');
  if (!cuerpo || !verificador) return documento;
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${verificador}`;
}

/** Un RUT se guarda con guion; un documento extranjero, nunca. */
export const esRut = (documento: string) => documento.includes('-');

export const MENSAJE_DOCUMENTO: Record<TipoDocumento, string> = {
  rut: 'RUT no válido: revisa los números y el dígito verificador',
  extranjero: 'Documento no válido: usa de 4 a 15 letras o números',
};
