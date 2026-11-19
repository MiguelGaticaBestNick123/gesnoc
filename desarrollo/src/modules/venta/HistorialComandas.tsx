'use client';

import { Badge, Card, Group, NativeSelect, Stack, Text, TextInput } from '@mantine/core';
import { IconListSearch, IconSearch, IconUser } from '@tabler/icons-react';
import { useState } from 'react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { RefrescoPeriodico } from '@/shared/ui/RefrescoPeriodico';
import { SinNocheAbierta } from '@/shared/ui/SinNocheAbierta';
import { esAlergia } from './notas';
import {
  filtrarHistorial,
  type ComandaDelHistorial,
  type EstadoComanda,
  type PedidoDelHistorial,
} from './historial';
import type { HistorialDeComandas } from './servicios/historial';

const estados: Record<EstadoComanda, { color: string; texto: (c: ComandaDelHistorial) => string }> =
  {
    pendiente: { color: 'yellow', texto: () => 'En preparación' },
    lista: { color: 'green', texto: (c) => `Lista ${c.lista}` },
    entregada: { color: 'violeta', texto: (c) => `Entregada ${c.entregada}` },
    anulada: { color: 'gray', texto: () => 'Anulada' },
  };

function Comanda({ comanda }: Readonly<{ comanda: ComandaDelHistorial }>) {
  const estado = estados[comanda.estado];
  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="sm" fw={700}>
          {comanda.estacion}
        </Text>
        <Badge color={estado.color} variant="light" tt="none">
          {estado.texto(comanda)}
        </Badge>
      </Group>
      {comanda.lineas.map((linea) => (
        <div key={linea.linea}>
          <Text
            size="sm"
            td={linea.anulada ? 'line-through' : undefined}
            c={linea.anulada ? 'dimmed' : undefined}
          >
            {linea.cantidad} × {linea.producto}
            {linea.anulada && ' (anulado)'}
          </Text>
          {linea.nota && (
            <Text size="xs" c={esAlergia(linea.nota) ? 'red.4' : 'yellow.4'} fw={600}>
              {linea.nota}
            </Text>
          )}
        </div>
      ))}
    </Stack>
  );
}

function TarjetaPedido({ pedido }: Readonly<{ pedido: PedidoDelHistorial }>) {
  return (
    <Card withBorder padding="md" component="article" aria-label={`Pedido ${pedido.pedido}`}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div style={{ minWidth: 0 }}>
            <Text fw={700} size="lg">
              Pedido {pedido.pedido}{' '}
              <Text span c="dimmed" fw={500} size="md">
                · {pedido.hora}
              </Text>
            </Text>
            <Text size="sm" c="dimmed">
              {pedido.ambiente} · {pedido.ubicacion}
              {pedido.personas !== null &&
                ` · ${pedido.personas} ${pedido.personas === 1 ? 'persona' : 'personas'}`}
            </Text>
          </div>
          <Badge
            size="lg"
            variant="light"
            color="violeta"
            tt="none"
            leftSection={<IconUser size={13} />}
            style={{ flexShrink: 0 }}
          >
            {pedido.garzon}
          </Badge>
        </Group>
        {pedido.comandas.map((comanda) => (
          <Comanda key={comanda.estacionId} comanda={comanda} />
        ))}
      </Stack>
    </Card>
  );
}

/**
 * Historial de comandas de la noche (pedido del Product Owner, 18 nov): qué se pidió, a qué hora,
 * para qué mesa y quién lo tomó, y en qué va cada comanda. Se actualiza solo cada 5 segundos.
 */
export function HistorialComandas({ datos }: Readonly<{ datos: HistorialDeComandas }>) {
  const [estacion, setEstacion] = useState(
    datos.estacionInicial === null ? 'todas' : String(datos.estacionInicial),
  );
  const [texto, setTexto] = useState('');
  const encabezado = (descripcion?: string) => (
    <EncabezadoPagina
      icono={IconListSearch}
      titulo="Historial de comandas"
      descripcion={descripcion}
    />
  );

  if (!datos.noche) {
    return (
      <Stack gap="md">
        {encabezado()}
        <SinNocheAbierta />
      </Stack>
    );
  }

  const visibles = filtrarHistorial(
    datos.pedidos,
    estacion === 'todas' ? null : Number(estacion),
    texto,
  );
  return (
    <Stack gap="md" maw={900}>
      <RefrescoPeriodico segundos={5} />
      {encabezado(
        `${datos.pedidos.length} ${datos.pedidos.length === 1 ? 'pedido' : 'pedidos'} esta noche, del más reciente al más antiguo.`,
      )}
      <Group grow align="flex-end" wrap="wrap">
        <NativeSelect
          label="Estación"
          value={estacion}
          onChange={(evento) => setEstacion(evento.currentTarget.value)}
          data={[
            { value: 'todas', label: 'Todas' },
            ...datos.estaciones.map((e) => ({ value: String(e.id), label: e.nombre })),
          ]}
          miw={160}
        />
        <TextInput
          label="Buscar"
          placeholder="Mesa, garzón o producto"
          value={texto}
          onChange={(evento) => setTexto(evento.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          miw={180}
        />
      </Group>
      {visibles.length === 0 ? (
        <Text c="dimmed">
          {datos.pedidos.length === 0
            ? 'Todavía no hay pedidos esta noche.'
            : 'Ningún pedido coincide con la búsqueda.'}
        </Text>
      ) : (
        visibles.map((pedido) => <TarjetaPedido key={pedido.pedido} pedido={pedido} />)
      )}
    </Stack>
  );
}
