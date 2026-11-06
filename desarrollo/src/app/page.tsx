import { Card, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconQrcode } from '@tabler/icons-react';
import { roles } from '@/modules/acceso/roles';

export default function Inicio() {
  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>GesNoc</Title>
          <Text c="dimmed">Gestión nocturna: turnos, pedidos, caja y puerta en un solo lugar.</Text>
        </div>
        <div>
          <Title order={2} size="h4" mb={4}>
            Local de demostración
          </Title>
          <Text size="sm" c="dimmed">
            Elige con qué rol entrar. Con el inicio de sesión, cada persona llegará a la pantalla de
            su turno.
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {roles.map((rol) => {
            const Icono = rol.icono;
            return (
              <Card
                key={rol.clave}
                component="a"
                href={`/${rol.clave}`}
                withBorder
                padding="lg"
                aria-label={`Entrar como ${rol.nombre}`}
              >
                <Stack gap="xs">
                  <Group gap="sm">
                    <ThemeIcon size="lg" variant="light">
                      <Icono size={20} />
                    </ThemeIcon>
                    <Text fw={700}>{rol.nombre}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {rol.descripcion}
                  </Text>
                </Stack>
              </Card>
            );
          })}
          <Card
            component="a"
            href="/carta/demo"
            withBorder
            padding="lg"
            aria-label="Abrir la carta"
          >
            <Stack gap="xs">
              <Group gap="sm">
                <ThemeIcon size="lg" variant="light">
                  <IconQrcode size={20} />
                </ThemeIcon>
                <Text fw={700}>Carta del cliente</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Lo que abre el cliente al escanear el código QR de su mesa.
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
