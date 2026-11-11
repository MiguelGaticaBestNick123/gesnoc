'use client';

import { useEffect, useState } from 'react';

type VentanaConAudio = Window & { webkitAudioContext?: typeof AudioContext };

// Un solo contexto para toda la aplicación: iOS limita cuántos se crean y solo deja sonar el que se
// activó dentro de un toque.
let contexto: AudioContext | null = null;

function contextoDeAudio(): AudioContext | null {
  if (contexto) return contexto;
  const Constructor = window.AudioContext ?? (window as VentanaConAudio).webkitAudioContext;
  if (!Constructor) return null;
  contexto = new Constructor();
  return contexto;
}

/**
 * Pitido corto y vibración. Con la música del local, el aviso en pantalla no basta: el barman está
 * de espaldas preparando. Falla en silencio: si no hay audio, el aviso visual sigue estando.
 */
export function avisar(frecuencia = 880, patron: number[] = [200, 100, 200]) {
  try {
    const ctx = contexto;
    if (ctx?.state === 'running') {
      const oscilador = ctx.createOscillator();
      const volumen = ctx.createGain();
      oscilador.frequency.value = frecuencia;
      volumen.gain.setValueAtTime(0.15, ctx.currentTime);
      oscilador.connect(volumen).connect(ctx.destination);
      oscilador.start();
      oscilador.stop(ctx.currentTime + 0.18);
    }
    navigator.vibrate?.(patron);
  } catch {
    // Sin audio ni vibración (iOS no vibra): queda el aviso en pantalla.
  }
}

/** El sonido se activa con el primer toque en la pantalla; mientras tanto, la pantalla lo pide. */
export function useSonido(): boolean {
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    const activar = () => {
      const ctx = contextoDeAudio();
      if (!ctx) return;
      ctx
        .resume()
        .then(() => setActivo(ctx.state === 'running'))
        .catch(() => {});
    };
    window.addEventListener('pointerdown', activar);
    return () => window.removeEventListener('pointerdown', activar);
  }, []);
  return activo;
}
