'use client';

import { Button, Card, Stack, Text } from '@mantine/core';
import Link from 'next/link';

/** Una pantalla sin datos todavía: qué falta y un botón para resolverlo. */
export function EstadoVacio({
  texto,
  accion,
  href,
}: Readonly<{ texto: string; accion: string; href: string }>) {
  return (
    <Card withBorder padding="lg">
      <Stack gap="sm" align="flex-start">
        <Text c="dimmed">{texto}</Text>
        <Button component={Link} href={href} size="sm" mih={44} variant="light">
          {accion}
        </Button>
      </Stack>
    </Card>
  );
}
