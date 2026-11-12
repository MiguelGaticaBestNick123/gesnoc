import { Card, Group, Text, ThemeIcon } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';

/**
 * Una cifra con su ícono, para las portadas: lo que se lee de un vistazo. `compacta` oculta el
 * ícono en el teléfono, para que dos cifras quepan por fila sin cortar la etiqueta.
 */
export function Cifra({
  icono: Icono,
  color,
  etiqueta,
  valor,
  detalle,
  compacta = false,
}: Readonly<{
  icono: Icon;
  color: string;
  etiqueta: string;
  valor: string;
  detalle?: string;
  compacta?: boolean;
}>) {
  return (
    <Card withBorder padding="md" role="group" aria-label={`${etiqueta}: ${valor}`}>
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon
          size={48}
          radius="xl"
          variant="light"
          color={color}
          visibleFrom={compacta ? 'sm' : undefined}
        >
          <Icono size={26} stroke={1.7} />
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="sm" c="dimmed">
            {etiqueta}
          </Text>
          <Text fw={700} fz={26} lh={1.15}>
            {valor}
          </Text>
          {detalle && (
            <Text size="xs" c="dimmed">
              {detalle}
            </Text>
          )}
        </div>
      </Group>
    </Card>
  );
}
