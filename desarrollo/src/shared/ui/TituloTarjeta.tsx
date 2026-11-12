import { Group, Title } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';

/** El título de una tarjeta de cifras, con su ícono en el violeta de la marca. */
export function TituloTarjeta({
  icono: Icono,
  children,
}: Readonly<{ icono: Icon; children: React.ReactNode }>) {
  return (
    <Group gap="xs" mb="sm">
      <Icono size={20} stroke={1.7} color="var(--mantine-color-violeta-3)" />
      <Title order={3} size="h5">
        {children}
      </Title>
    </Group>
  );
}
