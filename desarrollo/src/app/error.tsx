'use client';

import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { mensajeDeFalla } from '@/shared/red';

// Lo que se ve si una pantalla falla al cargar: nunca una página en blanco ni un error técnico.
export default function ErrorDePantalla({
  error,
  retry,
}: Readonly<{ error: Error & { digest?: string }; retry: () => void }>) {
  return (
    <Container size={420} py="xl">
      <Stack gap="md">
        <Title order={2}>No se pudo cargar esta pantalla</Title>
        <Text c="dimmed">{mensajeDeFalla(error)}</Text>
        <Button onClick={() => retry()}>Reintentar</Button>
        <Button variant="subtle" component="a" href="/">
          Ir al inicio
        </Button>
      </Stack>
    </Container>
  );
}
