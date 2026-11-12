'use client';

import { Alert, Anchor, Card, Group, Stack, Text } from '@mantine/core';
import { IconCircleCheck, IconReceipt2 } from '@tabler/icons-react';
import Link from 'next/link';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { RefrescoPeriodico } from '@/shared/ui/RefrescoPeriodico';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora } from '@/shared/utilidades/fechas';
import { cerrarConSaldo } from './acciones';
import type { PantallaSaldos } from './servicios/caja';

// HU-27: las cuentas que siguen abiertas. Para cerrar la noche no puede quedar ninguna (RN-20): el
// garzón las cobra, o la administración cierra una con su saldo y queda registrado quién lo hizo.
export function CuentasConSaldo({ datos }: Readonly<{ datos: PantallaSaldos }>) {
  const saldo = datos.cuentas.reduce((suma, cuenta) => suma + cuenta.saldo, 0);
  return (
    <Stack gap="md" maw={900}>
      <RefrescoPeriodico segundos={5} />
      <EncabezadoPagina
        icono={IconReceipt2}
        titulo="Cuentas con saldo"
        descripcion={
          datos.noche
            ? `${datos.cuentas.length} abiertas · ${formatearPesos(saldo)} por cobrar. Cerrar una con saldo es excepcional y queda registrado.`
            : 'Las cuentas abiertas de la noche.'
        }
      />

      {!datos.noche && (
        <Alert color="gray" variant="light">
          No hay una noche abierta.
        </Alert>
      )}
      {datos.noche && datos.cuentas.length === 0 && (
        <Card withBorder padding="lg">
          <Group gap="sm">
            <IconCircleCheck size={28} color="var(--mantine-color-green-5)" />
            <Text fw={600}>No quedan cuentas abiertas.</Text>
          </Group>
        </Card>
      )}

      {datos.cuentas.map((cuenta) => (
        <Card key={cuenta.numero} withBorder padding="md">
          <Stack gap="sm">
            <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
              <div style={{ minWidth: 0 }}>
                <Text fw={700} size="lg" truncate>
                  {cuenta.ubicacion} · {cuenta.ambiente}
                </Text>
                <Text size="sm" c="dimmed">
                  Cuenta {cuenta.numero} · {cuenta.garzon} · desde {formatearHora(cuenta.abiertaEn)}
                </Text>
                <Anchor component={Link} href={`/garzon/cuenta/${cuenta.numero}/detalle`} size="sm">
                  Ver el detalle
                </Anchor>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text size="xs" c="dimmed">
                  Saldo
                </Text>
                <Text fw={800} fz={22} lh={1.1} c={cuenta.saldo > 0 ? 'yellow.4' : undefined}>
                  {formatearPesos(cuenta.saldo)}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatearPesos(cuenta.consumo)} − {formatearPesos(cuenta.pagado)} pagado
                </Text>
              </div>
            </Group>
            <BotonAccion
              accion={cerrarConSaldo}
              datos={{ numero: cuenta.numero }}
              etiqueta={
                cuenta.saldo > 0
                  ? `Cerrar con saldo ${formatearPesos(cuenta.saldo)}`
                  : 'Cerrar cuenta'
              }
              color={cuenta.saldo > 0 ? 'red' : undefined}
              variant="light"
              fullWidth
              aria-label={`Cerrar la cuenta ${cuenta.numero}`}
              confirmar={
                cuenta.saldo > 0
                  ? `¿Cerrar la cuenta ${cuenta.numero} (${cuenta.ubicacion}) con ${formatearPesos(cuenta.saldo)} sin cobrar? Queda registrado que la cerraste tú.`
                  : `¿Cerrar la cuenta ${cuenta.numero} (${cuenta.ubicacion})?`
              }
            />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
