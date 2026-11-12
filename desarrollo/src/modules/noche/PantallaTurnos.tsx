import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import type { Actor } from '@/shared/autorizacion';
import { mesDe, mesValido } from '@/shared/utilidades/calendario';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { formatearFecha, hoyEnChile, tituloDeFecha } from '@/shared/utilidades/fechas';
import { declararDisponibilidad } from './acciones';
import { nombreDelRol } from './nombres';
import { CalendarioPersonal } from './CalendarioPersonal';
import { miCalendario, misTurnos } from './servicios/turnos';
import { IconCalendarUser } from '@tabler/icons-react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';

/** HU-09: el calendario propio del mes y, debajo, las próximas noches para postular. */
export async function PantallaTurnos({
  actor,
  ruta,
  mes,
}: Readonly<{ actor: Actor; ruta: string; mes?: string }>) {
  const mesElegido = mesValido(mes) ?? mesDe(hoyEnChile());
  const [noches, calendario] = await Promise.all([
    misTurnos(actor),
    miCalendario(actor, mesElegido),
  ]);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconCalendarUser}
        titulo="Mis turnos"
        descripcion="Avisa qué noches puedes trabajar y revisa los turnos que te asignaron."
      />

      <Card withBorder padding="sm">
        <CalendarioPersonal key={mesElegido} datos={calendario} ruta={ruta} />
      </Card>

      <Title order={3} size="h5">
        Próximas noches
      </Title>
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
              <Badge color="violeta" variant="light">
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
