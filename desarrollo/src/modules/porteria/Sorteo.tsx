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
import { useCallback, useState } from 'react';
import { enviarJson } from '@/shared/red';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearHora, tituloDeFecha } from '@/shared/utilidades/fechas';
import { formatearDocumento } from '@/shared/utilidades/rut';
import { Espectaculo, type FaseSorteo } from './Espectaculo';
import type { Ganador, PantallaSorteo } from './servicios/sorteo';
import { SinNocheAbierta } from '@/shared/ui/SinNocheAbierta';

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/** El giro frena de a poco: cada número dura un poco más que el anterior (~1,6 s en total). */
const PAUSAS_DEL_GIRO = [50, 50, 55, 60, 65, 75, 85, 100, 120, 145, 175, 210, 250, 300];

/** Un número cualquiera para el giro; el ganador real lo elige el servidor. */
const numeroDelGiro = (tope: number) => 1 + Math.floor(Math.random() * tope);

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

// HU-37: el guardia sortea el premio de cada ambiente. El ganador lo elige el servidor; mientras
// tanto, una pantalla completa hace la cuenta regresiva y gira el número, para proyectarlo en el local.
export function Sorteo({ inicial }: Readonly<{ inicial: PantallaSorteo }>) {
  const router = useRouter();
  const [rodando, setRodando] = useState<number | null>(null);
  const [resultados, setResultados] = useState<Record<number, Ganador>>({});
  const [error, setError] = useState<string | null>(null);
  const [espectaculo, setEspectaculo] = useState<{
    ambiente: string;
    participantes: number;
    fase: FaseSorteo;
  } | null>(null);
  const cerrarEspectaculo = useCallback(() => setEspectaculo(null), []);

  if (!inicial.noche) {
    return (
      <Stack gap="md">
        <EncabezadoPagina icono={IconTrophy} titulo="Sorteo" />
        <SinNocheAbierta />
      </Stack>
    );
  }

  async function sortear(ambienteId: number, nombre: string) {
    // Es irreversible (RN-23): un toque accidental no debe revelar al ganador antes de tiempo.
    const confirmado = window.confirm(
      `¿Sortear el premio de ${nombre} entre ${inicial.participantes} ${inicial.participantes === 1 ? 'ticket' : 'tickets'}? El sorteo no se repite.`,
    );
    if (!confirmado) return;
    // Los que participaron: al refrescar, el ganador ya no cuenta entre los que pueden ganar.
    const participantes = inicial.participantes;
    const mostrar = (fase: FaseSorteo) => setEspectaculo({ ambiente: nombre, participantes, fase });
    setError(null);
    setRodando(ambienteId);
    // El servidor elige al ganador mientras la pantalla cuenta y gira.
    const pedido = enviarJson<Ganador>('/api/puerta/sorteo', { ambienteId });
    for (const valor of [3, 2, 1]) {
      mostrar({ tipo: 'cuenta', valor });
      await esperar(700);
    }
    const tope = Math.max(9, inicial.ultimoTicket);
    for (const pausa of PAUSAS_DEL_GIRO) {
      mostrar({ tipo: 'giro', valor: numeroDelGiro(tope) });
      await esperar(pausa);
    }
    const respuesta = await pedido;
    setRodando(null);
    if (!respuesta.ok) {
      setEspectaculo(null);
      setError(
        respuesta.incierto
          ? `${respuesta.error} Volver a sortear es seguro: si ya salió un ganador, se muestra el mismo.`
          : respuesta.error,
      );
      return;
    }
    setResultados((anteriores) => ({ ...anteriores, [ambienteId]: respuesta.datos }));
    mostrar({ tipo: 'ganador', ganador: respuesta.datos });
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
                  <Text ta="center" c="dimmed">
                    Sorteando…
                  </Text>
                ) : (
                  <Button
                    size="lg"
                    color="yellow"
                    leftSection={<IconConfetti size={20} />}
                    disabled={!ambiente.premio || inicial.participantes === 0 || rodando !== null}
                    onClick={() => void sortear(ambiente.id, ambiente.nombre)}
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
      {espectaculo && (
        <Espectaculo
          ambiente={espectaculo.ambiente}
          participantes={espectaculo.participantes}
          fase={espectaculo.fase}
          alCerrar={cerrarEspectaculo}
        />
      )}
    </Stack>
  );
}
