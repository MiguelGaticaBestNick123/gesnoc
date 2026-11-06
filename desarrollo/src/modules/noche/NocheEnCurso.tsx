'use client';

import { Badge, Card, Group, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import { abrirNoche } from './acciones';
import type { nocheAbierta, Noche } from './repositorios/noches';

interface Props {
  abierta: Awaited<ReturnType<typeof nocheAbierta>>;
  programadas: Noche[];
}

export function NocheEnCurso({ abierta, programadas }: Readonly<Props>) {
  return (
    <Stack gap="md">
      <Title order={2}>Noche en curso</Title>

      {abierta ? (
        <Card withBorder padding="lg">
          <Group gap="xs">
            <Text fw={700} size="lg">
              {tituloDeFecha(abierta.fecha)}
            </Text>
            <Badge color="green" variant="light">
              Abierta
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Fondo de caja {formatearPesos(abierta.fondoInicial)} · Entrada{' '}
            {formatearPesos(abierta.precioEntrada)} · {abierta.asignados} con turno
          </Text>
          {abierta.nota && <Text size="sm">{abierta.nota}</Text>}
        </Card>
      ) : programadas.length === 0 ? (
        <Text c="dimmed">No hay noches programadas: crea una en el calendario.</Text>
      ) : (
        <Card withBorder padding="lg">
          <FormularioAccion accion={abrirNoche} textoEnviar="Abrir noche">
            <NativeSelect
              name="fecha"
              label="Noche"
              size="md"
              data={programadas.map((noche) => ({
                value: noche.fecha,
                label: tituloDeFecha(noche.fecha),
              }))}
            />
            <TextInput
              name="fondo"
              label="Fondo de caja"
              description="Efectivo con que abre la caja."
              type="number"
              inputMode="numeric"
              size="md"
              required
            />
          </FormularioAccion>
        </Card>
      )}
    </Stack>
  );
}
