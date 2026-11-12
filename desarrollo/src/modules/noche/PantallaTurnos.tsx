import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import type { Actor } from '@/shared/autorizacion';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { formatearFecha, tituloDeFecha } from '@/shared/utilidades/fechas';
import { declararDisponibilidad } from './acciones';
import { nombreDelRol } from './nombres';
import { misTurnos } from './servicios/turnos';
import { IconCalendarEvent } from '@tabler/icons-react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';

export async function PantallaTurnos({ actor }: Readonly<{ actor: Actor }>) {
  const noches = await misTurnos(actor);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconCalendarEvent}
        titulo="Mis turnos"
        descripcion="Avisa qué noches puedes trabajar y revisa los turnos que te asignaron."
      />

      {noches.length === 0 && <Text c="dimmed">No hay noches programadas.</Text>}

      {noches.map((noche) => (
        <Card key={noche.fecha} withBorder padding="sm">
          <Group gap="xs">
            <Text fw={600}>{tituloDeFecha(noche.fecha)}</Text>
            {noche.abierta && (
              <Badge color="green" variant="light">
                Abierta
              </Badge>
            )}
            {noche.disponible && (
              <Badge color="violet" variant="light">
                Disponible
              </Badge>
            )}
          </Group>
          {noche.nota && <Text size="sm">{noche.nota}</Text>}
          <Text size="sm" c="dimmed">
            {noche.rol
              ? ['Turno:', nombreDelRol[noche.rol], noche.ambiente && `en ${noche.ambiente}`]
                  .filter(Boolean)
                  .join(' ')
              : 'Sin turno asignado'}
          </Text>
          {!noche.abierta && (
            <Group mt="xs">
              <BotonAccion
                accion={declararDisponibilidad}
                datos={
                  noche.disponible
                    ? { fecha: noche.fecha }
                    : { fecha: noche.fecha, disponible: 'on' }
                }
                etiqueta={noche.disponible ? 'Ya no puedo' : 'Puedo trabajar'}
                variant={noche.disponible ? 'default' : 'light'}
                aria-label={`${noche.disponible ? 'Ya no puedo' : 'Puedo trabajar'} el ${formatearFecha(noche.fecha)}`}
              />
            </Group>
          )}
        </Card>
      ))}
    </Stack>
  );
}
