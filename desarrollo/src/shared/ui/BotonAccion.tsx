'use client';

import { Button, Text, type ButtonProps } from '@mantine/core';
import { useActionState } from 'react';
import { conManejoDeRed, type Accion } from './accion';

interface Props extends ButtonProps {
  accion: Accion;
  datos: Record<string, string | number>;
  etiqueta: string;
  /** Pregunta que se hace antes de una acción difícil de deshacer. */
  confirmar?: string;
}

// Acción de un solo toque sobre un registro: desactivar, eliminar, quitar.
export function BotonAccion({ accion, datos, etiqueta, confirmar, ...boton }: Readonly<Props>) {
  const [estado, ejecutar, pendiente] = useActionState(conManejoDeRed(accion), {});

  return (
    <form
      action={ejecutar}
      onSubmit={(evento) => {
        if (confirmar && !window.confirm(confirmar)) evento.preventDefault();
      }}
    >
      {Object.entries(datos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      <Button type="submit" variant="light" size="sm" mih={44} loading={pendiente} {...boton}>
        {etiqueta}
      </Button>
      {estado.error && (
        <Text c="red" size="sm" role="alert">
          {estado.error}
        </Text>
      )}
    </form>
  );
}
