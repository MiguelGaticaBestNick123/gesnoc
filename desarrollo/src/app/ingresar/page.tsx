import { Box, Card, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconMoonStars } from '@tabler/icons-react';
import { redirect } from 'next/navigation';
import { FormularioIngreso } from '@/modules/acceso/FormularioIngreso';
import { inicioDe } from '@/shared/autorizacion';
import { actorActual } from '@/shared/sesion';

export const metadata = { title: 'Ingresar · GesNoc' };

export default async function PaginaIngreso() {
  const actor = await actorActual();
  if (actor) redirect(inicioDe(actor));

  return (
    <Box
      mih="100dvh"
      px="md"
      py="xl"
      style={{
        display: 'grid',
        placeItems: 'center',
        // Un resplandor violeta arriba, como la luz del local sobre el fondo nocturno.
        background:
          'radial-gradient(ellipse 90% 45% at 50% -5%, rgba(116, 80, 251, 0.3), transparent 70%), var(--mantine-color-body)',
      }}
    >
      <Stack gap="lg" w="100%" maw={400}>
        <Stack gap={6} align="center" ta="center">
          <ThemeIcon
            size={64}
            radius="lg"
            variant="gradient"
            gradient={{ from: 'violeta.4', to: 'violeta.8', deg: 135 }}
            mb={6}
          >
            <IconMoonStars size={36} />
          </ThemeIcon>
          <Title order={1}>GesNoc</Title>
          <Text c="dimmed">Gestión nocturna: turnos, pedidos, caja y puerta en un solo lugar.</Text>
        </Stack>
        <Card withBorder padding="lg" shadow="xl">
          <FormularioIngreso />
        </Card>
        <Text size="xs" c="dimmed" ta="center">
          No hay registro público: las cuentas las crea la administración del local.
        </Text>
      </Stack>
    </Box>
  );
}
