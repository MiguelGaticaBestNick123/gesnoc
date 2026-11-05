import { Anchor, Container, Stack, Text, Title } from '@mantine/core';

export default function Inicio() {
  return (
    <Container size="xs" py="xl">
      <Stack gap="sm">
        <Title order={1}>GesNoc</Title>
        <Text c="dimmed">Gestión nocturna: turnos, pedidos, caja y puerta en un solo lugar.</Text>
        <Anchor href="/mesas" fw={600} mt="md">
          Entrar al local de demostración
        </Anchor>
      </Stack>
    </Container>
  );
}
