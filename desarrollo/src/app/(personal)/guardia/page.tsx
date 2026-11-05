import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { entradasNoche, recaudado } from '@/modules/porteria/demostracion';
import { formatearPesos } from '@/shared/utilidades/dinero';

export const metadata = { title: 'Entrada · GesNoc' };

// Esqueleto de la puerta: el registro real llega con HU-30 y el escaneo de la cédula con HU-31.
export default function PaginaGuardia() {
  const ultimoTicket = entradasNoche.find((e) => e.ticket !== null)?.ticket;

  return (
    <Stack gap="md">
      <Title order={2}>Entrada</Title>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder>
          <Text size="sm" c="dimmed">
            Personas registradas
          </Text>
          <Text fw={700} size="xl">
            {entradasNoche.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="sm" c="dimmed">
            Recaudado
          </Text>
          <Text fw={700} size="xl">
            {formatearPesos(recaudado(entradasNoche))}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="sm" c="dimmed">
            Último ticket
          </Text>
          <Text fw={700} size="xl">
            {ultimoTicket}
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="lg">
        <Stack gap="sm">
          <TextInput
            label="Documento"
            placeholder="RUT o documento extranjero"
            size="md"
            disabled
          />
          <Group grow>
            <Button variant="default" disabled>
              Escanear cédula
            </Button>
            <Button disabled>Registrar entrada</Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Stack gap="xs">
          <Text fw={600}>Últimos ingresos</Text>
          {entradasNoche.map((e) => (
            <Group key={e.hora} justify="space-between">
              <Text size="sm">{e.hora}</Text>
              {e.ticket ? (
                <Badge variant="light">Ticket {e.ticket}</Badge>
              ) : (
                <Badge color="gray" variant="light">
                  Gratis
                </Badge>
              )}
              <Text size="sm">{formatearPesos(e.monto)}</Text>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
