'use client';

import { useEffect } from 'react';

/**
 * Mantiene la pantalla encendida mientras la vista está abierta: en la barra y la cocina el teléfono
 * queda apoyado y, si se bloquea, la cola deja de actualizarse. El permiso se pierde al ocultar la
 * pestaña, así que se vuelve a pedir al volver. Requiere HTTPS; si el navegador no lo permite, la
 * pantalla se apaga como siempre.
 */
export function usePantallaEncendida() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let bloqueo: WakeLockSentinel | null = null;
    let vigente = true;

    const pedir = async () => {
      if (!vigente || document.visibilityState !== 'visible') return;
      try {
        bloqueo = await navigator.wakeLock.request('screen');
      } catch {
        // Batería baja o permiso denegado.
      }
    };

    void pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      vigente = false;
      document.removeEventListener('visibilitychange', pedir);
      bloqueo?.release().catch(() => {});
    };
  }, []);
}
