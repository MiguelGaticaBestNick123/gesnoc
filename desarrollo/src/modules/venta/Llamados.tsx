'use client';

import { Alert, Badge, Box, Button, Card, Group, Paper, Stack, Text } from '@mantine/core';
import { IconBell, IconBellRinging } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { SinNocheAbierta } from '@/shared/ui/SinNocheAbierta';
import { llamaDesde } from './cola';
import type { LlamadoPendiente } from './repositorios/llamados';
import type { MisComandas } from './servicios/colas';

export const URL_COMANDAS = '/api/vivo/comandas';
export const RUTA_LLAMADOS = '/garzon/llamados';

/**
 * HU-40 CA2: marcar atendido. Mientras la consulta no lo confirma, el llamado ya no se muestra; ante
 * un corte basta con volver a tocar, porque repetirlo no registra otra hora.
 */
export function useAtender(actualizar: () => Promise<void>) {
  const [atendiendo, setAtendiendo] = useState<number | null>(null);
  const [atendidos, setAtendidos] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function atender(numero: number) {
    setAtendiendo(numero);
    setError(null);
    const respuesta = await enviarJson('/api/llamados/atendido', { numero });
    setAtendiendo(null);
    if (respuesta.ok) setAtendidos((actuales) => [...actuales, numero]);
    else setError(respuesta.error);
    await actualizar();
  }

  const pendientes = (llamados: LlamadoPendiente[]) =>
    llamados.filter((l) => !atendidos.includes(l.numero));
  return { atender, atendiendo, error, pendientes };
}

type Atencion = ReturnType<typeof useAtender>;

/**
 * HU-40: el llamado de una mesa flota sobre cualquier pantalla del garzón, como el aviso de comanda
 * lista, hasta que alguien lo atiende. No se posterga: el cliente está esperando.
 */
export function AvisoLlamados({
  llamados,
  atencion,
}: Readonly<{ llamados: LlamadoPendiente[]; atencion: Atencion }>) {
  const primero = llamados[0];
  if (!primero) return null;

  return (
    <Box
      pos="fixed"
      top={64}
      right={8}
      left="calc(var(--app-shell-navbar-offset, 0px) + 8px)"
      style={{ zIndex: 151 }}
    >
      <Paper
        shadow="lg"
        p="sm"
        withBorder
        role="region"
        aria-label="Llamado de una mesa"
        style={{ borderColor: 'var(--mantine-color-orange-6)', borderWidth: 2 }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <IconBellRinging size={22} color="var(--mantine-color-orange-5)" aria-hidden />
            <div style={{ minWidth: 0 }}>
              <Text fw={700}>Mesa {primero.mesa} te llama</Text>
              <Text size="sm" c="dimmed">
                {primero.ambiente} · {llamaDesde(primero.espera)}
              </Text>
            </div>
          </Group>
          {llamados.length > 1 && <Badge color="orange">{llamados.length}</Badge>}
        </Group>
        {atencion.error && (
          <Text size="sm" c="red.4" role="alert">
            {atencion.error}
          </Text>
        )}
        <Group gap="xs" mt="xs" grow>
          {llamados.length > 1 && (
            <Button component={Link} href={RUTA_LLAMADOS} variant="default" mih={44}>
              Ver todos
            </Button>
          )}
          <Button
            color="orange"
            mih={44}
            loading={atencion.atendiendo === primero.numero}
            onClick={() => void atencion.atender(primero.numero)}
            aria-label={`Marcar atendido el llamado de la mesa ${primero.mesa}`}
          >
            Atendido
          </Button>
        </Group>
      </Paper>
    </Box>
  );
}

/** HU-40: todos los llamados pendientes de las mesas del ambiente, del más antiguo al más nuevo. */
export function LlamadosVista({ inicial }: Readonly<{ inicial: MisComandas }>) {
  const { datos, sinConexion, actualizar } = useTiempoReal(URL_COMANDAS, inicial);
  const atencion = useAtender(actualizar);
  const llamados = atencion.pendientes(datos.llamados);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconBell}
        titulo="Llamados"
        descripcion={
          llamados.length === 0
            ? 'Ninguna mesa está llamando.'
            : `${llamados.length} ${llamados.length === 1 ? 'mesa espera' : 'mesas esperan'} atención`
        }
      />
      <AvisoConexion sinConexion={sinConexion} />
      {!datos.noche && <SinNocheAbierta />}
      {atencion.error && (
        <Alert color="red" variant="light" role="alert">
          {atencion.error}
        </Alert>
      )}
      {llamados.map((llamado) => (
        <Card
          key={llamado.numero}
          withBorder
          padding="sm"
          component="article"
          aria-label={`Llamado de la mesa ${llamado.mesa}`}
          style={{ borderColor: 'var(--mantine-color-orange-6)' }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Text fw={700}>Mesa {llamado.mesa}</Text>
            <Text size="sm" c="dimmed">
              {llamado.ambiente} · {llamaDesde(llamado.espera)}
            </Text>
          </Group>
          <Button
            mt="xs"
            color="orange"
            mih={44}
            fullWidth
            loading={atencion.atendiendo === llamado.numero}
            onClick={() => void atencion.atender(llamado.numero)}
            aria-label={`Marcar atendido el llamado de la mesa ${llamado.mesa}`}
          >
            Atendido
          </Button>
        </Card>
      ))}
    </Stack>
  );
}
