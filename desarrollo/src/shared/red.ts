// Fallas de red vistas desde el teléfono. Un corte no dice si el servidor alcanzó a registrar algo:
// por eso se distingue del rechazo, que asegura que no se registró nada.

export const CORTE_DE_RED =
  'Sin conexión: no se pudo confirmar. Revisa la señal y vuelve a intentarlo.';
export const APP_ACTUALIZADA =
  'La aplicación se actualizó: recarga la página y vuelve a intentarlo.';
const FALLA_DEL_SERVIDOR = 'Algo falló en el servidor. Vuelve a intentarlo.';

export function mensajeDeFalla(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  if (/failed to find server action|unexpected response was received/i.test(texto)) {
    return APP_ACTUALIZADA;
  }
  if (/fetch|network|load failed|timeout|connection|offline/i.test(texto)) return CORTE_DE_RED;
  return FALLA_DEL_SERVIDOR;
}

export type Respuesta<T> =
  | { ok: true; datos: T }
  /** `incierto`: no se sabe si quedó registrado; reintentar con la misma clave es seguro. */
  | { ok: false; error: string; incierto: boolean };

/** Envía una operación de la noche y traduce el resultado. */
export async function enviarJson<T>(url: string, cuerpo: unknown): Promise<Respuesta<T>> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    return { ok: false, error: CORTE_DE_RED, incierto: true };
  }

  if (respuesta.status === 401) {
    // Al recargar, la página lleva a la persona al ingreso.
    window.location.reload();
    return { ok: false, error: 'La sesión expiró', incierto: false };
  }
  const datos = (await respuesta.json().catch(() => null)) as (T & { error?: string }) | null;
  if (respuesta.ok && datos) return { ok: true, datos };

  // Un 4xx es un rechazo de negocio: la transacción no registró nada. Un 5xx o una respuesta
  // ilegible pueden venir de un intermediario después de que el servidor guardó.
  const incierto = respuesta.status >= 500 || !datos;
  return {
    ok: false,
    error: datos?.error ?? (incierto ? CORTE_DE_RED : FALLA_DEL_SERVIDOR),
    incierto,
  };
}

/** UUID v4 para la clave de envío. `randomUUID` solo existe con HTTPS; `getRandomValues`, siempre. */
export function nuevaClaveDeEnvio(): string {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
