'use client';

import { Center, Loader } from '@mantine/core';
import dynamic from 'next/dynamic';

// Un cobro sin confirmar vive en el almacenamiento del teléfono, que no existe en el servidor: esta
// pantalla se dibuja solo en el navegador, y así el reintento pendiente aparece desde el primer
// momento.
export const CobrarCliente = dynamic(() => import('./Cobrar').then((modulo) => modulo.Cobrar), {
  ssr: false,
  loading: () => (
    <Center py="xl">
      <Loader />
    </Center>
  ),
});
