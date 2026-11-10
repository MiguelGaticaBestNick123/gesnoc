'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const INTERVALO_MS = 3000;
const FALLOS_PARA_AVISAR = 2;

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
      const respuesta = await fetch(url, { cache: 'no-store' });
      // Sesión vencida o turno cambiado: la página decide adónde va la persona.
      if (respuesta.status === 401 || respuesta.status === 403) {
        window.location.reload();
        return;
      }
      if (!respuesta.ok) throw new Error(`Respuesta ${respuesta.status}`);
      setDatos((await respuesta.json()) as T);
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
