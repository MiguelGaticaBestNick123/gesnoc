import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import { roles } from '@/modules/acceso/roles';

const secciones = roles.flatMap((rol) =>
  rol.secciones.filter((s) => s.ruta).map((seccion) => ({ rol, seccion })),
);

export const dynamicParams = false;

export function generateStaticParams() {
  return secciones.map(({ rol, seccion }) => ({ rol: rol.clave, seccion: seccion.ruta }));
}

// Esqueleto de las secciones que aún no se construyen: indica qué historias del backlog
// las completarán. Cada una se reemplaza por su propia página al tomar la historia.
export default async function PaginaSeccion({
  params,
}: Readonly<{ params: Promise<{ rol: string; seccion: string }> }>) {
  const { rol, seccion } = await params;
  const encontrada = secciones.find((s) => s.rol.clave === rol && s.seccion.ruta === seccion);
  if (!encontrada) notFound();

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{encontrada.seccion.etiqueta}</Title>
        <Text c="dimmed" size="sm">
          {encontrada.seccion.descripcion}
        </Text>
      </div>
      <Card withBorder padding="lg">
        <Stack gap="xs">
          <Text fw={600}>Sección en construcción</Text>
          <Group gap="xs">
            {encontrada.seccion.historias?.map((historia) => (
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
