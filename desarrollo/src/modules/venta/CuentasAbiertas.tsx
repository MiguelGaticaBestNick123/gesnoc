'use client';

import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
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
      mesa.cuenta === null
        ? []
        : [{ numero: mesa.cuenta, lugar: `Mesa ${mesa.numero}`, desde: mesa.abiertaEn ?? '' }],
    ),
    ...datos.dePie.map((cuenta) => ({
      numero: cuenta.numero,
      lugar: cuenta.referencia ?? 'De pie',
      desde: cuenta.abiertaEn,
    })),
  ].toSorted((a, b) => a.numero - b.numero);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Cuentas abiertas</Title>
          <Text c="dimmed" size="sm">
            {datos.ambiente.nombre}: {cuentas.length} abiertas
          </Text>
        </div>
        <Button size="sm" mih={44} variant="light" onClick={nueva.open} disabled={!datos.noche}>
          Cliente de pie
        </Button>
      </Group>
      <AvisoConexion sinConexion={sinConexion} />

      {cuentas.length === 0 && <Text c="dimmed">No hay cuentas abiertas en este ambiente.</Text>}
      {cuentas.map((cuenta) => (
        <Button
          key={cuenta.numero}
          component={Link}
          href={`/garzon/cuenta/${cuenta.numero}`}
          variant="default"
          justify="space-between"
          rightSection={cuenta.desde && formatearHora(cuenta.desde)}
        >
          Cuenta {cuenta.numero} · {cuenta.lugar}
        </Button>
      ))}

      <NuevaCuentaDePie
        ambienteId={datos.ambiente.id}
        abierto={nuevaAbierta}
        alCerrar={nueva.close}
      />
    </Stack>
  );
}
