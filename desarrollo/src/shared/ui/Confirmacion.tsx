'use client';

import { Button, Group, Modal } from '@mantine/core';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

// Las preguntas antes de una acción difícil de deshacer se hacen en la misma pantalla, con el
// estilo del sistema, y no con el diálogo del navegador (pedido del Product Owner, 18 nov). El botón
// que acepta repite la acción («Quitar», «Recibí $25.190»): así se lee qué se va a hacer.

export interface Pregunta {
  /** La pregunta, por ejemplo «¿Recibiste $25.190 en efectivo de Diego Soto?». */
  mensaje: string;
  /** El texto del botón que acepta; por omisión, «Aceptar». */
  aceptar?: string;
  /** Una acción que borra o quita algo: el botón que acepta va en rojo. */
  peligro?: boolean;
}

type Confirmar = (pregunta: Pregunta) => Promise<boolean>;

const Contexto = createContext<Confirmar | null>(null);

export function ProveedorConfirmacion({ children }: Readonly<{ children: React.ReactNode }>) {
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const responder = useRef<((acepta: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>(
    (nueva) =>
      new Promise((resolver) => {
        // Una pregunta nueva deja sin efecto la anterior.
        responder.current?.(false);
        responder.current = resolver;
        setPregunta(nueva);
      }),
    [],
  );

  const cerrar = (acepta: boolean) => {
    responder.current?.(acepta);
    responder.current = null;
    setPregunta(null);
  };

  return (
    <Contexto value={confirmar}>
      {children}
      <Modal
        opened={pregunta !== null}
        onClose={() => cerrar(false)}
        title={pregunta?.mensaje}
        centered
        zIndex={400}
        styles={{ title: { fontWeight: 600, lineHeight: 1.35 } }}
      >
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button
            color={pregunta?.peligro ? 'red' : undefined}
            onClick={() => cerrar(true)}
            data-autofocus
          >
            {pregunta?.aceptar ?? 'Aceptar'}
          </Button>
        </Group>
      </Modal>
    </Contexto>
  );
}

/** Pregunta en pantalla y responde si la persona aceptó. Sin proveedor, no confirma nada. */
export function useConfirmar(): Confirmar {
  return useContext(Contexto) ?? (async () => false);
}
