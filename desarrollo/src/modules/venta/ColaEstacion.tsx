'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { usePantallaEncendida } from '@/shared/navegador/pantalla-encendida';
import { avisar, useSonido } from '@/shared/navegador/sonido';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import {
  minutos,
  nivelDeEspera,
  pedidosNuevos,
  type ComandaEnCola,
  type NivelDeEspera,
  type TipoEstacion,
} from './cola';
import type { ColaDeEstacion } from './servicios/colas';

const colorDe: Record<NivelDeEspera, string> = {
  normal: 'gray',
  atrasada: 'yellow',
  critica: 'red',
};

const haceCuanto = (segundos: number) =>
  minutos(segundos) === 0 ? 'recién lista' : `lista hace ${minutos(segundos)} min`;

const sinEstacion: Record<TipoEstacion, string> = {
  barra: 'Tu ambiente no tiene una barra configurada: avisa a la administración.',
  cocina: 'Tu ambiente no tiene una cocina configurada: avisa a la administración.',
};

// HU-17, HU-18 y HU-19: la cola de la estación, al día cada pocos segundos, con sonido al entrar
// una comanda y la pantalla siempre encendida.
export function ColaEstacion({ inicial }: Readonly<{ inicial: ColaDeEstacion }>) {
  const [estacionId, setEstacionId] = useState(inicial.estacion?.id);
  const url = `/api/vivo/cola?tipo=${inicial.tipo}${estacionId ? `&estacion=${estacionId}` : ''}`;
  const { datos, sinConexion, actualizar } = useTiempoReal(url, inicial);
  const sonido = useSonido();
  usePantallaEncendida();
  const [marcando, setMarcando] = useState<number | null>(null);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Suena solo cuando entra una comanda nueva: no al cargar ni al cambiar de estación.
  const vistas = useRef({
    estacion: datos.estacion?.id,
    pedidos: datos.pendientes.map((c) => c.pedido),
  });
  useEffect(() => {
    const actuales = datos.pendientes.map((c) => c.pedido);
    const mismaEstacion = vistas.current.estacion === datos.estacion?.id;
    if (mismaEstacion && pedidosNuevos(vistas.current.pedidos, actuales).length > 0) avisar(660);
    vistas.current = { estacion: datos.estacion?.id, pedidos: actuales };
  }, [datos.estacion?.id, datos.pendientes]);

  async function marcar(comanda: ComandaEnCola) {
    if (!datos.estacion) return;
    setMarcando(comanda.pedido);
    setError(null);
    const respuesta = await enviarJson('/api/comandas/lista', {
      pedido: comanda.pedido,
      estacionId: datos.estacion.id,
    });
    setMarcando(null);
    // Marcar es idempotente: ante un corte basta con volver a tocar.
    if (respuesta.ok) setMarcadas((actuales) => [...actuales, comanda.pedido]);
    else setError(respuesta.error);
    await actualizar();
  }

  const pendientes = datos.pendientes.filter((c) => !marcadas.includes(c.pedido));
  const titulo = datos.estacion?.nombre ?? (datos.tipo === 'barra' ? 'Barra' : 'Cocina');

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{titulo}</Title>
        <Text c="dimmed" size="sm">
          {pendientes.length} por preparar · {datos.listas.length}{' '}
          {datos.listas.length === 1 ? 'lista' : 'listas'} para retirar
        </Text>
        {/* Siempre ocupa la misma línea: si desapareciera al activarse, el primer toque movería la
            pantalla bajo el dedo y el botón tocado se perdería. */}
        <Text c="dimmed" size="xs" role="status">
          {sonido ? 'Sonido activo' : 'Toca la pantalla para activar el sonido'}
        </Text>
      </div>

      {datos.estaciones.length > 1 && (
        <SegmentedControl
          value={String(estacionId)}
          onChange={(valor) => {
            setEstacionId(Number(valor));
            setError(null);
          }}
          data={datos.estaciones.map((e) => ({ value: String(e.id), label: e.nombre }))}
        />
      )}

      <AvisoConexion sinConexion={sinConexion} />
      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}
      {!datos.noche && (
        <Alert color="yellow" variant="light">
          No hay una noche abierta.
        </Alert>
      )}
      {datos.noche && !datos.estacion && (
        <Alert color="yellow" variant="light">
          {sinEstacion[datos.tipo]}
        </Alert>
      )}
      {datos.noche && datos.estacion && pendientes.length === 0 && (
        <Text c="dimmed">Sin comandas por preparar.</Text>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {pendientes.map((comanda) => (
          <TarjetaComanda
            key={comanda.pedido}
            comanda={comanda}
            conPersonas={datos.tipo === 'cocina'}
            marcando={marcando === comanda.pedido}
            alMarcar={() => void marcar(comanda)}
          />
        ))}
      </SimpleGrid>

      {datos.listas.length > 0 && (
        <Stack gap="xs">
          <Title order={3} size="h5">
            Listas para retirar
          </Title>
          {datos.listas.map((comanda) => (
            <Card
              key={comanda.pedido}
              withBorder
              padding="sm"
              component="article"
              aria-label={`Pedido ${comanda.pedido}, lista`}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text fw={600} td={comanda.anulada ? 'line-through' : undefined}>
                  Pedido {comanda.pedido} · {comanda.ubicacion} · {comanda.garzon}
                </Text>
                <Text size="sm" c="dimmed">
                  {haceCuanto(comanda.listaHace ?? 0)}
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function TarjetaComanda({
  comanda,
  conPersonas,
  marcando,
  alMarcar,
}: Readonly<{
  comanda: ComandaEnCola;
  conPersonas: boolean;
  marcando: boolean;
  alMarcar: () => void;
}>) {
  const nivel = nivelDeEspera(comanda.espera);
  const destacada = nivel !== 'normal' && !comanda.anulada;
  return (
    <Card
      withBorder
      padding="md"
      component="article"
      aria-label={`Pedido ${comanda.pedido}`}
      style={{
        borderColor: destacada ? `var(--mantine-color-${colorDe[nivel]}-6)` : undefined,
        borderWidth: destacada ? 2 : undefined,
        opacity: comanda.anulada ? 0.6 : 1,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700} size="xl">
            Pedido {comanda.pedido}
          </Text>
          {comanda.anulada ? (
            <Badge color="gray">Anulada</Badge>
          ) : (
            <Badge color={colorDe[nivel]} variant={destacada ? 'filled' : 'light'} size="lg">
              {minutos(comanda.espera)} min
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          {conPersonas && `${comanda.ambiente} · `}
          {comanda.ubicacion} · {comanda.garzon}
        </Text>
        {conPersonas && comanda.personas !== null && (
          <Text fw={600}>
            Para {comanda.personas} {comanda.personas === 1 ? 'persona' : 'personas'}
          </Text>
        )}
        <Stack gap={4}>
          {comanda.lineas.map((linea) => (
            <div key={linea.linea}>
              <Text
                size="lg"
                fw={600}
                td={linea.anulada ? 'line-through' : undefined}
                c={linea.anulada ? 'dimmed' : undefined}
              >
                {linea.cantidad} × {linea.producto}
                {linea.anulada && ' (anulado)'}
              </Text>
              {linea.nota && (
                <Text size="sm" c="yellow.4" td={linea.anulada ? 'line-through' : undefined}>
                  Nota: {linea.nota}
                </Text>
              )}
            </div>
          ))}
        </Stack>
        {!comanda.anulada && (
          <Button
            size="lg"
            fullWidth
            loading={marcando}
            onClick={alMarcar}
            aria-label={`Marcar lista el pedido ${comanda.pedido}`}
          >
            Lista
          </Button>
        )}
      </Stack>
    </Card>
  );
}
