'use client';

import { Center, Loader } from '@mantine/core';
import dynamic from 'next/dynamic';

// El borrador vive en el almacenamiento del teléfono, que no existe en el servidor: esta pantalla se
// dibuja solo en el navegador, y así lo guardado aparece desde el primer momento.
export const PedidoCliente = dynamic(() => import('./Pedido').then((modulo) => modulo.Pedido), {
  ssr: false,
  loading: () => (
    <Center py="xl">
      <Loader />
    </Center>
  ),
});
