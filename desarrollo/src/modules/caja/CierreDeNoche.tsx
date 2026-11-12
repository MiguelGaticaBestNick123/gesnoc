'use client';

import { Card, Group, Stack, Text, ThemeIcon, Button } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearFecha } from '@/shared/utilidades/fechas';
import { cerrarNoche } from './acciones';
import { describirDiferencia } from './calculos';
import type { EstadoDelCierre } from './servicios/caja';

function Pendiente({
  listo,
  titulo,
  detalle,
  enlace,
}: Readonly<{ listo: boolean; titulo: string; detalle: string; enlace: string }>) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <ThemeIcon size={30} radius="xl" color={listo ? 'green' : 'red'} variant="light">
          {listo ? <IconCheck size={18} /> : <IconX size={18} />}
        </ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={600}>
            {titulo}
          </Text>
          <Text size="xs" c="dimmed">
            {detalle}
          </Text>
        </div>
      </Group>
      {!listo && (
        <Button component={Link} href={enlace} size="sm" mih={44} variant="subtle">
          Resolver
        </Button>
      )}
    </Group>
  );
}

// HU-12 (CU-11): antes de cerrar, la lista de lo que falta, con acceso a resolverlo. El servidor lo
// vuelve a revisar dentro de la transacción del cierre: esta lista solo orienta (RN-20).
export function CierreDeNoche({ estado }: Readonly<{ estado: EstadoDelCierre }>) {
  const { pendientes, esperado, conteo } = estado;
  const contado = conteo?.contado ?? null;
  const diferencia = contado !== null && esperado ? contado - esperado.total : null;
  const cuadraONota = diferencia === 0 || Boolean(conteo?.nota);
  const listo =
    pendientes.cuentasAbiertas === 0 &&
    pendientes.efectivoSinConfirmar === 0 &&
    !pendientes.sinContar &&
    cuadraONota;

  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <div>
          <Text fw={700} size="lg">
            Cerrar la noche
          </Text>
          <Text size="sm" c="dimmed">
            Al cerrar, la noche no admite más operaciones y el personal deja de ver su turno. Se
            anonimizan los clientes que no vienen hace 12 meses.
          </Text>
        </div>
        <Stack gap="sm">
          <Pendiente
            listo={pendientes.cuentasAbiertas === 0}
            titulo="Cuentas abiertas"
            detalle={
              pendientes.cuentasAbiertas === 0
                ? 'Todas cobradas o cerradas'
                : `Quedan ${pendientes.cuentasAbiertas}`
            }
            enlace="/admin/saldos"
          />
          <Pendiente
            listo={pendientes.efectivoSinConfirmar === 0}
            titulo="Efectivo de los garzones"
            detalle={
              pendientes.efectivoSinConfirmar === 0
                ? 'Todo confirmado'
                : `${pendientes.efectivoSinConfirmar} ${pendientes.efectivoSinConfirmar === 1 ? 'pago' : 'pagos'} sin confirmar`
            }
            enlace="/admin/efectivo"
          />
          <Pendiente
            listo={!pendientes.sinContar && cuadraONota}
            titulo="Arqueo"
            detalle={
              contado === null || diferencia === null
                ? 'Falta contar la caja'
                : `Contado ${formatearPesos(contado)} · ${describirDiferencia(diferencia)}${conteo?.nota ? ' · con nota' : ''}`
            }
            enlace="/admin/arqueo"
          />
        </Stack>
        <BotonAccion
          accion={cerrarNoche}
          datos={{ fecha: estado.fecha }}
          etiqueta="Cerrar la noche"
          variant="filled"
          color="red"
          fullWidth
          disabled={!listo}
          confirmar={`¿Cerrar la noche del ${formatearFecha(estado.fecha)}? Después no se puede registrar nada más en ella.`}
        />
      </Stack>
    </Card>
  );
}
