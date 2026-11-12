'use client';

import { Alert, Anchor, Card, Group, Paper, Stack, Text } from '@mantine/core';
import { IconCash, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora } from '@/shared/utilidades/fechas';
import type { MiEfectivo } from './servicios/pagos';

// CU-18 paso 6: el efectivo que cobró la persona y aún no entrega. Cada pago sale de la lista cuando
// la administración lo confirma (HU-26), así que se consulta en vivo.
export function EfectivoPorEntregar({ inicial }: Readonly<{ inicial: MiEfectivo }>) {
  const { datos, sinConexion } = useTiempoReal('/api/vivo/efectivo', inicial);
  const { pagos, total } = datos;

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconCash}
        titulo="Efectivo por entregar"
        descripcion="Lo que cobraste en efectivo y la administración aún no confirma."
      />
      <AvisoConexion sinConexion={sinConexion} />
      {!datos.noche && (
        <Alert color="yellow" variant="light">
          No hay una noche abierta.
        </Alert>
      )}

      <Paper withBorder p="md" bg="dark.6">
        <Text size="sm" c="dimmed">
          Por entregar a la administración
        </Text>
        <Text
          fz={38}
          fw={800}
          lh={1.15}
          c={total > 0 ? 'yellow.4' : undefined}
          aria-label={`Por entregar: ${formatearPesos(total)}`}
        >
          {formatearPesos(total)}
        </Text>
        <Text size="sm" c="dimmed">
          {pagos.length === 0
            ? 'Nada pendiente.'
            : `${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'} · incluye las propinas, que también pasan por la caja`}
        </Text>
      </Paper>

      {pagos.map((pago) => (
        <Card
          key={`${pago.cuenta}-${pago.numero}`}
          withBorder
          padding="sm"
          component={Link}
          href={`/garzon/cuenta/${pago.cuenta}/detalle`}
        >
          <Group justify="space-between" wrap="nowrap">
            <div style={{ minWidth: 0 }}>
              <Text fw={700} truncate>
                {pago.ubicacion}
              </Text>
              <Text size="xs" c="dimmed">
                Cuenta {pago.cuenta} · pago {pago.numero} · {formatearHora(pago.registradoEn)}
              </Text>
            </div>
            <Group gap="xs" wrap="nowrap">
              <div style={{ textAlign: 'right' }}>
                <Text fw={700}>{formatearPesos(pago.monto + pago.propina)}</Text>
                {pago.propina > 0 && (
                  <Text size="xs" c="dimmed">
                    {formatearPesos(pago.propina)} de propina
                  </Text>
                )}
              </div>
              <IconChevronRight size={18} color="var(--mantine-color-dimmed)" />
            </Group>
          </Group>
        </Card>
      ))}

      {pagos.length > 0 && (
        <Text size="sm" c="dimmed">
          Entrega el efectivo a la administración: al confirmarlo sale de esta lista.{' '}
          <Anchor component={Link} href="/garzon" size="sm">
            Volver a las mesas
          </Anchor>
        </Text>
      )}
    </Stack>
  );
}
