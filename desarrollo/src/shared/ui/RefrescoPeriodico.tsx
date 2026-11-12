'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Vuelve a pedir la página cada tantos segundos mientras se ve: para las listas de la caja, que
 * cambian cuando los garzones cobran. Lo que la persona escribe no se pierde, porque el componente no
 * se vuelve a montar.
 */
export function RefrescoPeriodico({ segundos = 5 }: Readonly<{ segundos?: number }>) {
  const router = useRouter();
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, segundos * 1000);
    return () => clearInterval(intervalo);
  }, [router, segundos]);
  return null;
}
