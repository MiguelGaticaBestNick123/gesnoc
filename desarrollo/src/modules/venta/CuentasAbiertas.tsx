'use client';

import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronRight, IconReceipt2, IconUserPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora } from '@/shared/utilidades/fechas';
import { NuevaCuentaDePie } from './NuevaCuentaDePie';
import type { Mapa } from './servicios/cuentas';

// Todas las cuentas abiertas del ambiente, con mesa o de pie, para llegar a una sin buscar en el mapa.
export function CuentasAbiertas({ inicial }: Readonly<{ inicial: Mapa }>) {
  const { datos, sinConexion } = useTiempoReal(
    `/api/vivo/mesas?ambiente=${inicial.ambiente.id}`,
    inicial,
  );
  const [nuevaAbierta, nueva] = useDisclosure(false);

  const cuentas = [
    ...datos.mesas.flatMap((mesa) =>
      mesa.cuenta === null ? [] : [{ ...mesa, numero: mesa.cuenta, lugar: `Mesa ${mesa.numero}` }],
    ),
    ...datos.dePie.map((cuenta) => ({ ...cuenta, lugar: cuenta.referencia ?? 'De pie' })),
  ].toSorted((a, b) => a.numero - b.numero);
  const total = cuentas.reduce((suma, cuenta) => suma + cuenta.total, 0);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconReceipt2}
        titulo="Cuentas abiertas"
        descripcion={`${datos.ambiente.nombre} · ${cuentas.length} abiertas · ${formatearPesos(total)} en mesa`}
      >
        <Button
          size="sm"
          mih={44}
          variant="light"
          leftSection={<IconUserPlus size={18} />}
          onClick={nueva.open}
          disabled={!datos.noche}
        >
          Cliente de pie
        </Button>
      </EncabezadoPagina>
      <AvisoConexion sinConexion={sinConexion} />

      {cuentas.length === 0 && <Text c="dimmed">No hay cuentas abiertas en este ambiente.</Text>}
      {cuentas.map((cuenta) => (
        <Card
          key={cuenta.numero}
          component={Link}
          href={`/garzon/cuenta/${cuenta.numero}`}
          padding="sm"
          withBorder
        >
          <Group justify="space-between" wrap="nowrap">
            <div style={{ minWidth: 0 }}>
              <Text fw={700} truncate>
                {cuenta.lugar}
              </Text>
              <Text size="xs" c="dimmed">
                Cuenta {cuenta.numero} · {cuenta.garzon} · desde{' '}
                {cuenta.abiertaEn && formatearHora(cuenta.abiertaEn)}
              </Text>
            </div>
            <Group gap="xs" wrap="nowrap">
              {cuenta.listas > 0 && <Badge color="green">Lista</Badge>}
              <Text fw={700}>{formatearPesos(cuenta.total)}</Text>
              <IconChevronRight size={18} color="var(--mantine-color-dimmed)" />
            </Group>
          </Group>
        </Card>
      ))}

      <NuevaCuentaDePie
        ambienteId={datos.ambiente.id}
        abierto={nuevaAbierta}
        alCerrar={nueva.close}
      />
    </Stack>
  );
}
