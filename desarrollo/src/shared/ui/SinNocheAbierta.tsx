import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconMoonOff } from '@tabler/icons-react';
import Link from 'next/link';

/**
 * El mismo aviso en todas las pantallas de la noche. Sin noche abierta solo la administración llega a
 * ellas (el personal no tiene turno), así que el aviso lleva a abrirla.
 */
export function SinNocheAbierta({ detalle }: Readonly<{ detalle?: string }>) {
  return (
    <Alert
      color="gray"
      variant="light"
      icon={<IconMoonOff size={20} />}
      title="No hay una noche abierta"
    >
      <Stack gap="xs" align="flex-start">
        <Text size="sm">
          {detalle ?? 'Esta pantalla se habilita cuando la administración abre la noche.'}
        </Text>
        <Button component={Link} href="/admin/noche" size="sm" mih={44}>
          Ir a la noche en curso
        </Button>
      </Stack>
    </Alert>
  );
}
