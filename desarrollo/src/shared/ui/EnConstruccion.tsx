import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';

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
      <div>
        <Title order={2}>{titulo}</Title>
        <Text c="dimmed" size="sm">
          {descripcion}
        </Text>
      </div>
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
