'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Flex,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { useState } from 'react';
import type { Ambiente, Mesa } from '@/modules/local/demostracion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { saldoCuenta, totalCuenta, type Cuenta, type EstadoComanda } from './demostracion';

const colorComanda: Record<EstadoComanda, string> = {
  pendiente: 'orange',
  lista: 'green',
  entregada: 'gray',
};

interface Props {
  ambientes: Ambiente[];
  cuentas: Cuenta[];
}

export function MapaMesas({ ambientes, cuentas }: Props) {
  const [ambienteId, setAmbienteId] = useState(String(ambientes[0]?.id ?? ''));
  const [mesaId, setMesaId] = useState<number | null>(null);
  // El plano se dibuja en las unidades del modelo y se escala al ancho disponible,
  // para que en un teléfono se vea completo y cada mesa siga siendo tocable.
  const { ref: refPlano, width: anchoDisponible } = useElementSize();

  const ambiente = ambientes.find((a) => String(a.id) === ambienteId);
  if (!ambiente) return null;

  const cuentaDe = (mesa: Mesa) => cuentas.find((c) => c.mesaId === mesa.id);
  const sinMesa = cuentas.filter((c) => c.mesaId === null && c.ambienteId === ambiente.id);
  const seleccionada = mesaId === null ? undefined : ambiente.mesas.find((m) => m.id === mesaId);
  const cuenta = seleccionada ? cuentaDe(seleccionada) : undefined;
  const ocupadas = ambiente.mesas.filter((m) => cuentaDe(m)).length;
  const escala = anchoDisponible > 0 ? Math.min(1, anchoDisponible / ambiente.planoAncho) : 1;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Mesas</Title>
          <Text c="dimmed" size="sm">
            {ocupadas} ocupadas · {ambiente.mesas.length - ocupadas} libres · {sinMesa.length} sin
            mesa
          </Text>
        </div>
        <SegmentedControl
          value={ambienteId}
          onChange={(v) => {
            setAmbienteId(v);
            setMesaId(null);
          }}
          data={ambientes.map((a) => ({ value: String(a.id), label: a.nombre }))}
        />
      </Group>

      <Flex align="flex-start" gap="md" direction={{ base: 'column', lg: 'row' }}>
        <Card withBorder padding="sm" style={{ flex: 1, width: '100%' }}>
          <Box ref={refPlano} w="100%" h={ambiente.planoAlto * escala}>
            <Box
              pos="relative"
              w={ambiente.planoAncho}
              h={ambiente.planoAlto}
              style={{
                transform: `scale(${escala})`,
                transformOrigin: 'top left',
                backgroundImage:
                  'linear-gradient(var(--mantine-color-dark-5) 1px, transparent 1px), linear-gradient(90deg, var(--mantine-color-dark-5) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                borderRadius: 'var(--mantine-radius-md)',
              }}
            >
              {ambiente.mesas.map((mesa) => {
                const c = cuentaDe(mesa);
                const activa = mesa.id === mesaId;
                const pendiente = c?.pedidos.some((p) =>
                  p.comandas.some((k) => k.estado !== 'entregada'),
                );
                return (
                  <UnstyledButton
                    key={mesa.id}
                    onClick={() => setMesaId(mesa.id)}
                    aria-label={`Mesa ${mesa.numero}${c ? ', ocupada' : ', libre'}`}
                    style={{
                      position: 'absolute',
                      left: mesa.posX,
                      top: mesa.posY,
                      width: mesa.ancho,
                      height: mesa.alto,
                      transform: `rotate(${mesa.rotacion}deg)`,
                      borderRadius: mesa.forma === 'redonda' ? '50%' : 'var(--mantine-radius-md)',
                      background: c
                        ? 'var(--mantine-color-violet-9)'
                        : 'var(--mantine-color-dark-6)',
                      border: `2px solid ${
                        activa
                          ? 'var(--mantine-color-violet-3)'
                          : c
                            ? 'var(--mantine-color-violet-6)'
                            : 'var(--mantine-color-dark-4)'
                      }`,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Stack gap={2} align="center">
                      <Text fw={700} size="lg">
                        {mesa.numero}
                      </Text>
                      {c && (
                        <Badge size="xs" color={pendiente ? 'orange' : 'green'} variant="filled">
                          {pendiente ? 'en preparación' : 'servida'}
                        </Badge>
                      )}
                    </Stack>
                  </UnstyledButton>
                );
              })}
            </Box>
          </Box>
          {sinMesa.length > 0 && (
            <>
              <Divider my="sm" label="Clientes de pie" labelPosition="left" />
              <Group gap="xs">
                {sinMesa.map((c) => (
                  <Badge key={c.numero} size="lg" variant="light">
                    Cuenta {c.numero}: {c.referencia}
                  </Badge>
                ))}
              </Group>
            </>
          )}
        </Card>

        <Card withBorder padding="md" w={{ base: '100%', lg: 380 }} style={{ flexShrink: 0 }}>
          {!seleccionada && (
            <Text c="dimmed">Elige una mesa para ver su cuenta o abrir una nueva.</Text>
          )}
          {seleccionada && !cuenta && (
            <Stack>
              <Group justify="space-between">
                <Title order={3}>Mesa {seleccionada.numero}</Title>
                <Badge color="gray">Libre</Badge>
              </Group>
              <Button fullWidth>Abrir cuenta</Button>
            </Stack>
          )}
          {seleccionada && cuenta && (
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={3}>Mesa {seleccionada.numero}</Title>
                <Badge color="violet">Cuenta {cuenta.numero}</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Abierta a las {cuenta.abiertaEn} · {cuenta.garzon}
              </Text>
              {cuenta.pedidos.map((pedido) => (
                <Box key={pedido.numero}>
                  <Group justify="space-between" mb={4}>
                    <Text fw={600} size="sm">
                      Pedido {pedido.numero} · {pedido.enviadoEn}
                    </Text>
                    <Group gap={4}>
                      {pedido.comandas.map((k) => (
                        <Badge
                          key={k.estacion}
                          size="xs"
                          color={colorComanda[k.estado]}
                          variant="light"
                        >
                          {k.estacion}: {k.estado}
                        </Badge>
                      ))}
                    </Group>
                  </Group>
                  <Table withRowBorders={false} verticalSpacing={2}>
                    <Table.Tbody>
                      {pedido.lineas.map((l) => (
                        <Table.Tr key={l.linea}>
                          <Table.Td>
                            {l.cantidad} × {l.producto}
                          </Table.Td>
                          <Table.Td ta="right">
                            {formatearPesos(l.cantidad * l.precioUnitario)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              ))}
              <Divider />
              <Group justify="space-between">
                <Text>Total</Text>
                <Text fw={700}>{formatearPesos(totalCuenta(cuenta))}</Text>
              </Group>
              {cuenta.pagado > 0 && (
                <Group justify="space-between">
                  <Text c="dimmed">Pagado</Text>
                  <Text c="dimmed">{formatearPesos(cuenta.pagado)}</Text>
                </Group>
              )}
              <Group justify="space-between">
                <Text fw={700}>Saldo</Text>
                <Text fw={700} c="violet.3" size="xl">
                  {formatearPesos(saldoCuenta(cuenta))}
                </Text>
              </Group>
              <Group grow>
                <Button variant="default" size="md">
                  Nuevo pedido
                </Button>
                <Button size="md">Cobrar</Button>
              </Group>
            </Stack>
          )}
        </Card>
      </Flex>
    </Stack>
  );
}
