'use client';

import { Alert, Button, Modal, Stack, TextInput } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { enviarJson } from '@/shared/red';

interface Props {
  ambienteId: number;
  abierto: boolean;
  alCerrar: () => void;
}

// HU-14: cuenta de un cliente de pie, ubicado por una seña (RN-07).
export function NuevaCuentaDePie({ ambienteId, abierto, alCerrar }: Readonly<Props>) {
  const router = useRouter();
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function abrirCuenta() {
    setEnviando(true);
    setError(null);
    const respuesta = await enviarJson<{ numero: number }>('/api/cuentas', {
      ambienteId,
      referencia,
    });
    setEnviando(false);
    if (respuesta.ok) router.push(`/garzon/cuenta/${respuesta.datos.numero}`);
    else setError(respuesta.error);
  }

  return (
    <Modal
      opened={abierto}
      onClose={() => {
        setReferencia('');
        setError(null);
        alCerrar();
      }}
      title="Cliente de pie"
    >
      <Stack
        gap="sm"
        component="form"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (referencia.trim()) void abrirCuenta();
        }}
      >
        {error && (
          <Alert color="red" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <TextInput
          label="Referencia para ubicarlo"
          placeholder="Por ejemplo: polera roja, junto a la barra"
          value={referencia}
          onChange={(evento) => setReferencia(evento.currentTarget.value)}
          maxLength={60}
          size="md"
          data-autofocus
        />
        <Button type="submit" loading={enviando} disabled={!referencia.trim()}>
          Abrir cuenta
        </Button>
      </Stack>
    </Modal>
  );
}
