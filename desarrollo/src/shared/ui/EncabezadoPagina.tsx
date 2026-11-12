import { Group, Text, ThemeIcon, Title } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';

interface Props {
  icono: Icon;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  /** Acciones a la derecha del título, por ejemplo un botón. */
  children?: React.ReactNode;
}

/**
 * Encabezado de cada pantalla: ícono, título, una línea de contexto y sus acciones. En un teléfono
 * angosto las acciones bajan a otra línea en vez de quedar cortadas.
 */
export function EncabezadoPagina({ icono: Icono, titulo, descripcion, children }: Readonly<Props>) {
  return (
    <Group justify="space-between" align="center" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <ThemeIcon size={44} radius="md" variant="light">
          <Icono size={24} stroke={1.7} />
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Title order={2} lh={1.15}>
            {titulo}
          </Title>
          {descripcion && (
            <Text c="dimmed" size="sm" lh={1.3}>
              {descripcion}
            </Text>
          )}
        </div>
      </Group>
      {children}
    </Group>
  );
}
