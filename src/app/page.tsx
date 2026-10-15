import { Container, Stack, Text, Title } from '@mantine/core';

export default function Inicio() {
  return (
    <Container size="xs" py="xl">
      <Stack gap="sm">
        <Title order={1}>GesNoc</Title>
        <Text c="dimmed">Gestión nocturna: turnos, pedidos, caja y puerta en un solo lugar.</Text>
      </Stack>
    </Container>
  );
}
