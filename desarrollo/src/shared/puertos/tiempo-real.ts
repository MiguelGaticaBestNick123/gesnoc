'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const INTERVALO_MS = 3000;
const FALLOS_PARA_AVISAR = 2;
/** Una consulta que tarda más que esto se corta y cuenta como falla. */
export const ESPERA_MAXIMA_MS = 8000;

export type Estado<T> = { sesionVencida: true } | { sesionVencida: false; datos: T };

/**
 * Una consulta del estado de la pantalla. Con mala señal, una petición puede quedar colgada sin
 * terminar ni fallar: sin un límite, bloquearía todas las consultas siguientes y la pantalla se
 * congelaría sin avisar «sin conexión». Se corta con `AbortController` y un temporizador (no con
 * `AbortSignal.timeout`, que Safari de iOS 15 no tiene); el límite cubre también la lectura de la
 * respuesta.
 */
export async function consultarEstado<T>(
  url: string,
  esperaMaxima = ESPERA_MAXIMA_MS,
): Promise<Estado<T>> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), esperaMaxima);
  try {
    const respuesta = await fetch(url, { cache: 'no-store', signal: control.signal });
    // Sesión vencida o turno cambiado: la página decide adónde va la persona.
    if (respuesta.status === 401 || respuesta.status === 403) return { sesionVencida: true };
    if (!respuesta.ok) throw new Error(`Respuesta ${respuesta.status}`);
    return { sesionVencida: false, datos: (await respuesta.json()) as T };
  } finally {
    clearTimeout(temporizador);
  }
}

export interface EnVivo<T> {
  datos: T;
  /** La última consulta falló: lo que se ve puede estar desactualizado. */
  sinConexion: boolean;
  /** Pide el estado ya, por ejemplo después de una operación propia. */
  actualizar: () => Promise<void>;
}

/**
 * Puerto de tiempo real (ADR-007). Esta implementación pide el estado completo de la pantalla cada
 * 3 segundos; si algún día se cambia por eventos del servidor, las pantallas no cambian.
 * Con la pestaña oculta no consulta, y al volver lo hace de inmediato.
 */
export function useTiempoReal<T>(url: string, inicial: T): EnVivo<T> {
  const [datos, setDatos] = useState(inicial);
  const [fallos, setFallos] = useState(0);
  const enCurso = useRef(false);

  const actualizar = useCallback(async () => {
    if (enCurso.current || document.visibilityState !== 'visible') return;
    enCurso.current = true;
    try {
      const estado = await consultarEstado<T>(url);
      if (estado.sesionVencida) {
        window.location.reload();
        return;
      }
      setDatos(estado.datos);
      setFallos(0);
    } catch {
      setFallos((anteriores) => anteriores + 1);
    } finally {
      enCurso.current = false;
    }
  }, [url]);

  useEffect(() => {
    // La primera consulta va en la cola de tareas: al cambiar la URL (otro ambiente u otra estación)
    // los datos se renuevan de inmediato, sin esperar el primer intervalo.
    const primera = setTimeout(() => void actualizar(), 0);
    const intervalo = setInterval(() => void actualizar(), INTERVALO_MS);
    const alVolver = () => void actualizar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      clearTimeout(primera);
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [actualizar]);

  return { datos, sinConexion: fallos >= FALLOS_PARA_AVISAR, actualizar };
}
