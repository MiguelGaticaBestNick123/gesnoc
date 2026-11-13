import { Container, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconQrcodeOff } from '@tabler/icons-react';

// Un código desconocido y uno regenerado (RN-28) se ven igual: no dan pistas a quien prueba códigos.
export default function CartaNoEncontrada() {
  return (
    <Container size={420} py="xl" px="md">
      <Stack gap="md" align="flex-start">
        <ThemeIcon size={48} radius="md" variant="light" color="gray">
          <IconQrcodeOff size={28} />
        </ThemeIcon>
        <Title order={1} size="h2">
          Este código no abre la carta
        </Title>
        <Text c="dimmed" size="lg">
          Puede que la mesa tenga un código nuevo. Pide ayuda al garzón para ver la carta de tu
          mesa.
        </Text>
      </Stack>
    </Container>
  );
}
