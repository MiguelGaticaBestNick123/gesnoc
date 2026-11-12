'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AvisoConexion } from './AvisoConexion';

/**
 * Vuelve a pedir la página cada tantos segundos mientras se ve: para las listas de la caja, que
 * cambian cuando los garzones cobran. Lo que la persona escribe no se pierde, porque el componente no
 * se vuelve a montar. Sin conexión lo avisa, como las pantallas en vivo.
 */
export function RefrescoPeriodico({ segundos = 5 }: Readonly<{ segundos?: number }>) {
  const router = useRouter();
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) router.refresh();
    }, segundos * 1000);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, [router, segundos]);
  return <AvisoConexion sinConexion={!enLinea} />;
}
