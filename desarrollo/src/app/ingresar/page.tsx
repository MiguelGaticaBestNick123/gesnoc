import { Card, Container, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';
import { FormularioIngreso } from '@/modules/acceso/FormularioIngreso';
import { inicioDe } from '@/shared/autorizacion';
import { actorActual } from '@/shared/sesion';

export const metadata = { title: 'Ingresar · GesNoc' };

export default async function PaginaIngreso() {
  const actor = await actorActual();
  if (actor) redirect(inicioDe(actor));

  return (
    <Container size={420} py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>GesNoc</Title>
          <Text c="dimmed">Gestión nocturna: turnos, pedidos, caja y puerta en un solo lugar.</Text>
        </div>
        <Card withBorder padding="lg">
          <FormularioIngreso />
        </Card>
      </Stack>
    </Container>
  );
}
