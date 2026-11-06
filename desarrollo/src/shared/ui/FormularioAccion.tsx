'use client';

import { Alert, Button, Stack } from '@mantine/core';
import { startTransition, useActionState, useEffect, type FormEvent } from 'react';
import type { EstadoAccion } from '@/shared/acciones';

export type Accion = (previo: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;

interface Props {
  accion: Accion;
  textoEnviar: string;
  alTerminar?: () => void;
  children: React.ReactNode;
}

// Formulario conectado a una acción de servidor: muestra el error y avisa cuando terminó bien.
export function FormularioAccion({ accion, textoEnviar, alTerminar, children }: Readonly<Props>) {
  const [estado, ejecutar, pendiente] = useActionState(accion, {});

  useEffect(() => {
    if (estado.ok) alTerminar?.();
  }, [estado, alTerminar]);

  // React vacía el formulario después de una acción. Enviándolo a mano, un error no le borra a la
  // persona lo que escribió; `action` queda para los envíos anteriores a la hidratación.
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    startTransition(() => ejecutar(datos));
  };

  return (
    <form action={ejecutar} onSubmit={enviar}>
      <Stack gap="sm">
        {estado.error && (
          <Alert color="red" variant="light" role="alert">
            {estado.error}
          </Alert>
        )}
        {children}
        <Button type="submit" loading={pendiente}>
          {textoEnviar}
        </Button>
      </Stack>
    </form>
  );
}
