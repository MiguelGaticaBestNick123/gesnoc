'use client';

import { Alert } from '@mantine/core';

// Se muestra cuando el sondeo falla: lo que está en pantalla puede no ser lo último.
export function AvisoConexion({ sinConexion }: Readonly<{ sinConexion: boolean }>) {
  if (!sinConexion) return null;
  return (
    <Alert color="yellow" variant="light" role="status">
      Sin conexión: lo que ves puede no estar al día. Se actualiza solo al volver la señal.
    </Alert>
  );
}
