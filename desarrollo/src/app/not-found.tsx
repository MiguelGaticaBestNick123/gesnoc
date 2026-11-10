import { Button, Container, Stack, Text, Title } from '@mantine/core';

export default function NoEncontrada() {
  return (
    <Container size={420} py="xl">
      <Stack gap="md">
        <Title order={2}>Esta página no existe</Title>
        <Text c="dimmed">Revisa la dirección o vuelve a tu pantalla.</Text>
        <Button component="a" href="/">
          Ir al inicio
        </Button>
      </Stack>
    </Container>
  );
}
