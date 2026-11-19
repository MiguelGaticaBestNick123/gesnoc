'use client';

import { Button, Text, type ButtonProps } from '@mantine/core';
import { startTransition, useActionState } from 'react';
import { conManejoDeRed, type Accion } from './accion';
import { useConfirmar } from './Confirmacion';

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
  const preguntar = useConfirmar();

  return (
    <form
      action={ejecutar}
      onSubmit={(evento) => {
        if (!confirmar) return;
        // La pregunta se hace en pantalla: el envío espera la respuesta.
        evento.preventDefault();
        const formulario = new FormData(evento.currentTarget);
        void preguntar({
          mensaje: confirmar,
          aceptar: etiqueta,
          peligro: boton.color === 'red',
        }).then((acepta) => {
          if (acepta) startTransition(() => ejecutar(formulario));
        });
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
