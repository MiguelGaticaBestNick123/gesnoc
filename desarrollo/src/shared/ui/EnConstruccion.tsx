import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { IconBarrierBlock } from '@tabler/icons-react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';

interface Props {
  titulo: string;
  descripcion?: string;
  historias?: string[];
}

// Esqueleto de una pantalla que aún no se construye: indica qué historias del backlog la
// completarán. Se reemplaza por la pantalla real al tomar la historia.
export function EnConstruccion({ titulo, descripcion, historias }: Readonly<Props>) {
  return (
    <Stack gap="md">
      <EncabezadoPagina icono={IconBarrierBlock} titulo={titulo} descripcion={descripcion} />
      <Card withBorder padding="lg">
        <Stack gap="xs">
          <Text fw={600}>Sección en construcción</Text>
          <Group gap="xs">
            {historias?.map((historia) => (
              <Badge key={historia} variant="light">
                {historia}
              </Badge>
            ))}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
