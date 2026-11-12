'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconConfetti, IconTicket, IconTrophy } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { enviarJson } from '@/shared/red';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearHora, tituloDeFecha } from '@/shared/utilidades/fechas';
import { formatearDocumento } from '@/shared/utilidades/rut';
import type { Ganador, PantallaSorteo } from './servicios/sorteo';

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

type Resultado = NonNullable<PantallaSorteo['ambientes'][number]['ganador']>;

function Ganadora({ ganador }: Readonly<{ ganador: Resultado }>) {
  return (
    <Stack gap={4} align="center" ta="center" role="status" aria-live="polite">
      <Group gap={6} c="dimmed">
        <IconTicket size={18} />
        <Text size="sm" fw={600} tt="uppercase">
          Ticket ganador
        </Text>
      </Group>
      <Text fw={800} fz={64} lh={1} c="yellow.4" aria-label={`Ticket ganador ${ganador.ticket}`}>
        {ganador.ticket}
      </Text>
      <Text fw={700} size="lg">
        {ganador.nombre} {ganador.apellido}
      </Text>
      <Text size="sm" c="dimmed">
        {formatearDocumento(ganador.documento)} · sorteado a las{' '}
        {formatearHora(ganador.realizadoEn)}
      </Text>
      <Text size="xs" c="dimmed">
        Compara el nombre con la cédula antes de entregar el premio.
      </Text>
    </Stack>
  );
}

// HU-37: el guardia sortea el premio de cada ambiente. El ganador lo elige el servidor; en el
// teléfono el número gira mientras tanto, para que el sorteo se vea en el local.
export function Sorteo({ inicial }: Readonly<{ inicial: PantallaSorteo }>) {
  const router = useRouter();
  const [rodando, setRodando] = useState<number | null>(null);
  const [numero, setNumero] = useState(1);
  const [resultados, setResultados] = useState<Record<number, Ganador>>({});
  const [error, setError] = useState<string | null>(null);

  if (!inicial.noche) {
    return (
      <Stack gap="md">
        <EncabezadoPagina icono={IconTrophy} titulo="Sorteo" />
        <Alert color="gray" variant="light">
          No hay una noche abierta.
        </Alert>
      </Stack>
    );
  }

  async function sortear(ambienteId: number) {
    setError(null);
    setRodando(ambienteId);
    const tope = Math.max(9, inicial.ultimoTicket);
    const giro = setInterval(() => setNumero(1 + Math.floor(Math.random() * tope)), 70);
    const [respuesta] = await Promise.all([
      enviarJson<Ganador>('/api/puerta/sorteo', { ambienteId }),
      esperar(2000),
    ]);
    clearInterval(giro);
    setRodando(null);
    if (!respuesta.ok) {
      setError(
        respuesta.incierto
          ? `${respuesta.error} Volver a sortear es seguro: si ya salió un ganador, se muestra el mismo.`
          : respuesta.error,
      );
      return;
    }
    setResultados((anteriores) => ({ ...anteriores, [ambienteId]: respuesta.datos }));
    router.refresh();
  }

  return (
    <Stack gap="md" maw={900}>
      <EncabezadoPagina
        icono={IconTrophy}
        titulo="Sorteo"
        descripcion={`${tituloDeFecha(inicial.noche)} · un sorteo por ambiente entre los tickets de la noche`}
      >
        <Badge size="lg" variant="light" tt="none">
          Participan {inicial.participantes} {inicial.participantes === 1 ? 'ticket' : 'tickets'}
        </Badge>
      </EncabezadoPagina>
      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {inicial.ambientes.map((ambiente) => {
          const ganador = resultados[ambiente.id] ?? ambiente.ganador;
          return (
            <Card key={ambiente.id} withBorder padding="lg">
              <Stack gap="md">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="yellow" size={44} radius="md">
                    <IconTrophy size={24} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} size="lg">
                      {ambiente.nombre}
                    </Text>
                    <Text size="sm" c={ambiente.premio ? undefined : 'dimmed'}>
                      {ganador?.premio ??
                        ambiente.premio ??
                        'Sin premio: la administración lo elige en el calendario'}
                    </Text>
                  </div>
                </Group>
                {ganador ? (
                  <Ganadora ganador={ganador} />
                ) : rodando === ambiente.id ? (
                  <Text
                    fw={800}
                    fz={64}
                    lh={1}
                    ta="center"
                    c="violeta.3"
                    aria-hidden
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {numero}
                  </Text>
                ) : (
                  <Button
                    size="lg"
                    color="yellow"
                    leftSection={<IconConfetti size={20} />}
                    disabled={!ambiente.premio || inicial.participantes === 0 || rodando !== null}
                    onClick={() => void sortear(ambiente.id)}
                    aria-label={`Sortear el premio de ${ambiente.nombre}`}
                  >
                    Sortear
                  </Button>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
