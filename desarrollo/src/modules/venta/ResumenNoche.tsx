'use client';

import {
  Alert,
  Anchor,
  Box,
  Card,
  Divider,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArmchair,
  IconCash,
  IconChefHat,
  IconClipboardList,
  IconLayoutDashboard,
  IconReceipt2,
  IconStar,
  IconWallet,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { fechaCorta, formatearHora } from '@/shared/utilidades/fechas';
import { nombreDelMedio } from './cobro';
import { iconoDelMedio } from './iconos';
import type { ResumenDeLaNoche } from './servicios/resumen';

function Cifra({
  icono: Icono,
  color,
  etiqueta,
  valor,
  detalle,
}: Readonly<{ icono: Icon; color: string; etiqueta: string; valor: string; detalle: string }>) {
  return (
    <Card withBorder padding="md" role="group" aria-label={`${etiqueta}: ${valor}`}>
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon size={48} radius="xl" variant="light" color={color}>
          <Icono size={26} stroke={1.7} />
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="sm" c="dimmed">
            {etiqueta}
          </Text>
          <Text fw={700} fz={26} lh={1.15}>
            {valor}
          </Text>
          <Text size="xs" c="dimmed">
            {detalle}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

function Titulo({ icono: Icono, children }: Readonly<{ icono: Icon; children: React.ReactNode }>) {
  return (
    <Group gap="xs" mb="sm">
      <Icono size={20} stroke={1.7} color="var(--mantine-color-violeta-3)" />
      <Title order={3} size="h5">
        {children}
      </Title>
    </Group>
  );
}

// Portada de la administración: la noche en cifras reales, al día cada pocos segundos.
export function ResumenNoche({ inicial }: Readonly<{ inicial: ResumenDeLaNoche }>) {
  const { datos, sinConexion } = useTiempoReal('/api/vivo/resumen', inicial);
  const { noche, cifras, cobros, ambientes, ultimos, masPedidos } = datos;

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconLayoutDashboard}
        titulo="Resumen de la noche"
        descripcion={
          noche ? `Noche abierta · ${fechaCorta(noche)} · se actualiza solo` : 'Sin noche abierta'
        }
      />
      <AvisoConexion sinConexion={sinConexion} />

      {!noche || !cifras ? (
        <Alert color="yellow" variant="light">
          No hay una noche abierta: las cifras aparecen al abrirla.{' '}
          <Anchor component={Link} href="/admin/noche">
            Ir a la noche en curso
          </Anchor>
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
          <Cifra
            icono={IconCash}
            color="violeta"
            etiqueta="Vendido"
            valor={formatearPesos(cifras.vendido)}
            detalle="Pedidos de la noche, sin anulados"
          />
          <Cifra
            icono={IconWallet}
            color="green"
            etiqueta="Cobrado"
            valor={formatearPesos(cifras.cobrado)}
            detalle="Pagos registrados, sin propinas"
          />
          <Cifra
            icono={IconReceipt2}
            color="yellow"
            etiqueta="Por cobrar"
            valor={formatearPesos(cifras.porCobrar)}
            detalle={`Saldo de ${cifras.cuentasAbiertas} cuentas abiertas`}
          />
          <Cifra
            icono={IconChefHat}
            color="blue"
            etiqueta="En preparación"
            valor={String(cifras.enPreparacion)}
            detalle="Comandas en barra y cocina"
          />
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, md: 2, lg: cobros ? 3 : 2 }} spacing="md">
        <Card withBorder padding="md">
          <Titulo icono={IconArmchair}>Mesas en tiempo real</Titulo>
          <Stack gap="md">
            {ambientes.map((ambiente) => {
              const libres = ambiente.mesas - ambiente.ocupadas;
              const porcentaje = ambiente.mesas ? (ambiente.ocupadas / ambiente.mesas) * 100 : 0;
              return (
                <div key={ambiente.id}>
                  <Group justify="space-between" mb={6}>
                    <Text fw={600}>{ambiente.nombre}</Text>
                    <Text size="sm" fw={600}>
                      {formatearPesos(ambiente.vendido)}
                    </Text>
                  </Group>
                  <Progress value={porcentaje} color="violeta" size="md" radius="xl" />
                  <Group gap="md" mt={6}>
                    <Punto color="var(--mantine-color-violeta-4)">
                      {ambiente.ocupadas} ocupadas
                    </Punto>
                    <Punto color="var(--mantine-color-dark-3)">{libres} libres</Punto>
                  </Group>
                </div>
              );
            })}
          </Stack>
        </Card>

        {cobros && <Cobros cobros={cobros} />}

        <Card withBorder padding="md">
          <Titulo icono={IconStar}>Lo más pedido</Titulo>
          {masPedidos.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay pedidos esta noche.
            </Text>
          ) : (
            <Stack gap="xs">
              {masPedidos.map((producto, i) => (
                <Group key={producto.producto} justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text fw={700} c="violeta.3" w={18}>
                      {i + 1}
                    </Text>
                    <Text truncate>{producto.producto}</Text>
                  </Group>
                  <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {producto.unidades} u · {formatearPesos(producto.monto)}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Titulo icono={IconClipboardList}>Últimos pedidos</Titulo>
        {ultimos.length === 0 ? (
          <Text size="sm" c="dimmed">
            Todavía no hay pedidos esta noche.
          </Text>
        ) : (
          <Stack gap="xs">
            {ultimos.map((pedido) => (
              <Group key={pedido.numero} justify="space-between" wrap="nowrap" align="flex-start">
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    Pedido {pedido.numero} · {pedido.ubicacion} · {pedido.ambiente}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {pedido.resumen} · {pedido.garzon}
                  </Text>
                </div>
                <Text size="sm" c="dimmed">
                  {formatearHora(pedido.enviadoEn)}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}

/**
 * HU-24: lo cobrado por medio de pago, de mayor a menor y en un solo color, porque se comparan los
 * montos y cada fila ya dice su nombre. Abajo, las propinas y el efectivo que falta entregar.
 */
function Cobros({ cobros }: Readonly<{ cobros: NonNullable<ResumenDeLaNoche['cobros']> }>) {
  const total = cobros.porMedio.reduce((suma, medio) => suma + medio.monto, 0);
  const ordenados = cobros.porMedio.toSorted((a, b) => b.monto - a.monto);
  const { porConfirmar } = cobros;

  return (
    <Card withBorder padding="md">
      <Titulo icono={IconWallet}>Cobros por medio de pago</Titulo>
      {total === 0 ? (
        <Text size="sm" c="dimmed">
          Todavía no hay cobros esta noche.
        </Text>
      ) : (
        <Stack gap="sm">
          {ordenados.map(({ medio, monto, pagos }) => {
            const Icono = iconoDelMedio[medio];
            const parte = monto / total;
            const porcentaje = `${Math.round(parte * 100)} %`;
            return (
              <div
                key={medio}
                role="group"
                aria-label={`${nombreDelMedio(medio)}: ${formatearPesos(monto)}, ${porcentaje}`}
              >
                <Group justify="space-between" wrap="nowrap" mb={6} gap="xs">
                  <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Icono size={18} stroke={1.7} color="var(--mantine-color-dimmed)" />
                    <Text fw={600} truncate>
                      {nombreDelMedio(medio)}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {pagos} {pagos === 1 ? 'pago' : 'pagos'}
                    </Text>
                  </Group>
                  <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                    {formatearPesos(monto)}{' '}
                    <Text span size="xs" c="dimmed">
                      · {porcentaje}
                    </Text>
                  </Text>
                </Group>
                <Barra parte={parte} />
              </div>
            );
          })}
        </Stack>
      )}
      <Divider my="sm" />
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" c="dimmed">
            Propinas
          </Text>
          <Text size="sm" fw={700}>
            {formatearPesos(cobros.propinas)}
          </Text>
        </Group>
        <Group justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            {porConfirmar.monto > 0 && (
              <IconAlertTriangle size={16} color="var(--mantine-color-yellow-4)" />
            )}
            <Text size="sm" c="dimmed">
              Efectivo por confirmar
            </Text>
          </Group>
          <Text size="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>
            {formatearPesos(porConfirmar.monto)}
            {porConfirmar.pagos > 0 && (
              <Text span size="xs" c="dimmed">
                {' '}
                · {porConfirmar.pagos} {porConfirmar.pagos === 1 ? 'pago' : 'pagos'}
              </Text>
            )}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * Barra de 8 px: cuadrada en la base y redondeada 4 px en el extremo del dato; el riel es un tono
 * suave del mismo violeta, para leer cada parte contra el total.
 */
function Barra({ parte }: Readonly<{ parte: number }>) {
  const forma = { borderRadius: '0 4px 4px 0' };
  return (
    <Box h={8} style={{ ...forma, background: 'var(--mantine-color-violeta-light)' }}>
      <Box
        h="100%"
        w={`${Math.round(parte * 1000) / 10}%`}
        style={{ ...forma, background: 'var(--mantine-color-violeta-5)' }}
      />
    </Box>
  );
}

function Punto({ color, children }: Readonly<{ color: string; children: React.ReactNode }>) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={9} h={9} style={{ borderRadius: '50%', background: color }} />
      <Text size="xs" c="dimmed">
        {children}
      </Text>
    </Group>
  );
}
