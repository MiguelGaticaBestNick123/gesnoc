'use client';

import { Alert, Avatar, Card, Divider, Group, Stack, Text } from '@mantine/core';
import { IconCash, IconCircleCheck } from '@tabler/icons-react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { RefrescoPeriodico } from '@/shared/ui/RefrescoPeriodico';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora } from '@/shared/utilidades/fechas';
import { confirmarEfectivo } from './acciones';
import type { PantallaEfectivo } from './servicios/caja';

const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');

// HU-26: la administración recibe el efectivo de cada garzón y lo confirma. Se confirman exactamente
// los pagos que se ven: si mientras tanto el garzón cobró otro, ese queda para la próxima entrega.
export function ConfirmarEfectivo({ datos }: Readonly<{ datos: PantallaEfectivo }>) {
  return (
    <Stack gap="md" maw={900}>
      <RefrescoPeriodico segundos={5} />
      <EncabezadoPagina
        icono={IconCash}
        titulo="Confirmar efectivo"
        descripcion="El efectivo que cada garzón entrega, con sus propinas. Al confirmarlo entra al esperado de la caja."
      />

      {!datos.noche && (
        <Alert color="gray" variant="light">
          No hay una noche abierta.
        </Alert>
      )}
      {datos.noche && datos.garzones.length === 0 && (
        <Card withBorder padding="lg">
          <Group gap="sm">
            <IconCircleCheck size={28} color="var(--mantine-color-green-5)" />
            <Text fw={600}>No queda efectivo por confirmar.</Text>
          </Group>
        </Card>
      )}

      {datos.garzones.map((garzon) => {
        const total = garzon.monto + garzon.propinas;
        const pagos = garzon.pagos.map(({ cuenta, numero }) => ({ cuenta, numero }));
        return (
          <Card key={garzon.usuarioId} withBorder padding="md">
            <Stack gap="sm">
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Avatar radius="xl" size={44} color="violeta" variant="light">
                    {iniciales(garzon.garzon)}
                  </Avatar>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} size="lg" truncate>
                      {garzon.garzon}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {garzon.pagos.length} {garzon.pagos.length === 1 ? 'pago' : 'pagos'} en
                      efectivo
                    </Text>
                  </div>
                </Group>
                <div style={{ textAlign: 'right' }}>
                  <Text fw={800} fz={24} lh={1.1}>
                    {formatearPesos(total)}
                  </Text>
                  {garzon.propinas > 0 && (
                    <Text size="xs" c="dimmed">
                      incluye {formatearPesos(garzon.propinas)} de propina
                    </Text>
                  )}
                </div>
              </Group>
              <Divider />
              <Stack gap={6}>
                {garzon.pagos.map((pago) => (
                  <Group
                    key={`${pago.cuenta}-${pago.numero}`}
                    justify="space-between"
                    wrap="nowrap"
                    gap="sm"
                  >
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>
                        {pago.ubicacion} · {pago.ambiente}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Cuenta {pago.cuenta} · pago {pago.numero} ·{' '}
                        {formatearHora(pago.registradoEn)}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700}>
                        {formatearPesos(pago.monto)}
                      </Text>
                      {pago.propina > 0 && (
                        <Text size="xs" c="dimmed">
                          + {formatearPesos(pago.propina)} propina
                        </Text>
                      )}
                    </div>
                  </Group>
                ))}
              </Stack>
              <BotonAccion
                accion={confirmarEfectivo}
                datos={{ pagos: JSON.stringify(pagos) }}
                etiqueta={`Recibí ${formatearPesos(total)}`}
                variant="filled"
                color="green"
                fullWidth
                aria-label={`Confirmar el efectivo de ${garzon.garzon}`}
                confirmar={`¿Recibiste ${formatearPesos(total)} en efectivo de ${garzon.garzon}?`}
              />
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
