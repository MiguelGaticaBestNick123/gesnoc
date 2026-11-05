'use client';

import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import type { ComandaEnCola, EstadoComanda } from './demostracion';

interface Props {
  titulo: string;
  comandas: ComandaEnCola[];
}

// Cola de una estación (RF-21 y RF-22). Marcar lista solo cambia el estado en pantalla
// hasta que la comanda se guarde en la base (HU-19).
export function ColaEstacion({ titulo, comandas }: Props) {
  const [listas, setListas] = useState<number[]>([]);

  const estadoDe = (comanda: ComandaEnCola): EstadoComanda =>
    listas.includes(comanda.pedido) ? 'lista' : comanda.estado;
  const pendientes = comandas.filter((c) => estadoDe(c) === 'pendiente').length;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{titulo}</Title>
        <Text c="dimmed" size="sm">
          {pendientes} pendientes · {comandas.length - pendientes} listas
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {comandas.map((comanda) => {
          const estado = estadoDe(comanda);
          return (
            <Card key={comanda.pedido} withBorder padding="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>Pedido {comanda.pedido}</Text>
                  <Badge color={estado === 'pendiente' ? 'orange' : 'green'}>{estado}</Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {comanda.ubicacion} · {comanda.garzon} · {comanda.enviadoEn}
                </Text>
                {comanda.lineas.map((l) => (
                  <Text key={l.linea}>
                    {l.cantidad} × {l.producto}
                  </Text>
                ))}
                {estado === 'pendiente' && (
                  <Button
                    mt="xs"
                    fullWidth
                    onClick={() => setListas((actual) => [...actual, comanda.pedido])}
                  >
                    Marcar lista
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
