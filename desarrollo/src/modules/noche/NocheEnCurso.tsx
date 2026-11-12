'use client';

import { Badge, Card, Group, NativeSelect, Stack, Text } from '@mantine/core';
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import { CierreDeNoche } from '@/modules/caja/CierreDeNoche';
import type { EstadoDelCierre } from '@/modules/caja/servicios/caja';
import { abrirNoche } from './acciones';
import type { nocheAbierta, Noche } from './repositorios/noches';
import { IconMoon } from '@tabler/icons-react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';

interface Props {
  abierta: Awaited<ReturnType<typeof nocheAbierta>>;
  programadas: (Noche & { pasada: boolean })[];
  cierre: EstadoDelCierre | null;
}

export function NocheEnCurso({ abierta, programadas, cierre }: Readonly<Props>) {
  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconMoon}
        titulo="Noche en curso"
        descripcion="Abrir la noche con el fondo de caja habilita la operación del personal; cerrarla, después de cuadrar la caja, deja la jornada registrada."
      />

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
        <EstadoVacio
          texto="No hay noches programadas para abrir."
          accion="Ir al calendario de noches"
          href="/admin/calendario"
        />
      ) : (
        <Card withBorder padding="lg">
          <FormularioAccion accion={abrirNoche} textoEnviar="Abrir noche">
            <NativeSelect
              name="fecha"
              label="Noche"
              size="md"
              data={programadas.map((noche) => ({
                value: noche.fecha,
                label: `${tituloDeFecha(noche.fecha)}${noche.pasada ? ' (ya pasó)' : ''}`,
              }))}
            />
            <CampoPesos
              name="fondo"
              label="Fondo de caja"
              description="Efectivo con que abre la caja."
              size="md"
              required
            />
          </FormularioAccion>
        </Card>
      )}

      {abierta && cierre && <CierreDeNoche estado={cierre} />}
    </Stack>
  );
}
