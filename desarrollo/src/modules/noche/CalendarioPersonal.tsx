'use client';

import { Badge, Box, Drawer, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { CalendarioMes, type DiaDelCalendario } from '@/shared/ui/CalendarioMes';
import { formatearFecha, tituloDeFecha } from '@/shared/utilidades/fechas';
import { declararDisponibilidad } from './acciones';
import { colorDelRol, nombreDelRol } from './nombres';
import type { MiCalendario } from './servicios/turnos';

type MiNoche = MiCalendario['noches'][string];

/** Qué es esa noche para la persona: su rol, su postulación o si todavía puede postular. */
function situacion(
  noche: MiNoche,
  hoy: string,
): { texto: string; color: string; contorno?: boolean } {
  const pasada = noche.estado === 'cerrada' || noche.fecha < hoy;
  if (noche.rol) {
    const rol = nombreDelRol[noche.rol] ?? noche.rol;
    return {
      texto: pasada ? `Trabajaste: ${rol}` : `Turno: ${rol}`,
      color: colorDelRol[noche.rol]!,
    };
  }
  if (pasada) return { texto: 'No trabajaste', color: 'gray' };
  if (noche.disponible) return { texto: 'Postulaste', color: 'green' };
  if (noche.estado === 'programada') {
    return { texto: 'Puedes postular', color: 'gray', contorno: true };
  }
  return { texto: 'Noche abierta', color: 'gray' };
}

// HU-09: el calendario propio. Cada noche se pinta según lo que fue o es para la persona: el rol que
// tuvo o tiene, si postuló, o si todavía puede postular.
export function CalendarioPersonal({
  datos,
  ruta,
}: Readonly<{ datos: MiCalendario; ruta: string }>) {
  const ancha = useMediaQuery('(min-width: 62em)');
  const [dia, setDia] = useState<string | null>(null);

  const dias: Record<string, DiaDelCalendario> = Object.fromEntries(
    Object.entries(datos.noches).map(([fecha, noche]) => {
      const { texto, color, contorno } = situacion(noche, datos.hoy);
      return [
        fecha,
        {
          etiqueta: `${formatearFecha(fecha)}, ${texto.toLowerCase()}`,
          color,
          contorno,
          contenido: (
            <Text size="xs" fw={600} lh={1.1} visibleFrom="sm" c={`${color}.2`}>
              {texto}
            </Text>
          ),
        },
      ];
    }),
  );
  const noche = dia ? datos.noches[dia] : undefined;
  const puedePostular = noche?.estado === 'programada' && noche.fecha >= datos.hoy;

  return (
    <Stack gap="sm">
      <Group gap="md">
        {[
          ...Object.entries(nombreDelRol).map(([rol, nombre]) => [nombre, colorDelRol[rol]!]),
          ['Postulaste', 'green'],
          ['Puedes postular', 'contorno'],
        ].map(([texto, color]) => (
          <Group key={texto} gap={6} wrap="nowrap">
            <Box
              w={10}
              h={10}
              style={
                color === 'contorno'
                  ? { borderRadius: 3, border: '1px dashed var(--mantine-color-gray-4)' }
                  : { borderRadius: 3, background: `var(--mantine-color-${color}-6)` }
              }
            />
            <Text size="xs" c="dimmed">
              {texto}
            </Text>
          </Group>
        ))}
      </Group>
      <CalendarioMes
        mes={datos.mes}
        hoy={datos.hoy}
        rutaDelMes={(mes) => `${ruta}?mes=${mes}`}
        dias={dias}
        seleccionado={dia}
        alElegir={setDia}
      />

      <Drawer
        opened={dia !== null}
        onClose={() => setDia(null)}
        position={ancha ? 'right' : 'bottom'}
        size={ancha ? 380 : '85%'}
        radius="lg"
        zIndex={400}
        closeButtonProps={{ 'aria-label': 'Cerrar' }}
        styles={
          ancha ? undefined : { content: { height: 'auto', maxHeight: '85dvh', flex: '0 0 auto' } }
        }
        title={
          dia && (
            <Text fw={700} size="lg">
              {tituloDeFecha(dia)}
            </Text>
          )
        }
      >
        {dia && !noche && <Text c="dimmed">El local no abre este día.</Text>}
        {dia && noche && (
          <Stack gap="sm">
            <Badge size="lg" color={situacion(noche, datos.hoy).color}>
              {situacion(noche, datos.hoy).texto}
            </Badge>
            {noche.rol && noche.ambiente && <Text>Ambiente: {noche.ambiente}</Text>}
            {noche.nota && <Text c="dimmed">{noche.nota}</Text>}
            {puedePostular && (
              <BotonAccion
                accion={declararDisponibilidad}
                datos={noche.disponible ? { fecha: dia } : { fecha: dia, disponible: 'on' }}
                etiqueta={noche.disponible ? 'Ya no puedo' : 'Puedo trabajar'}
                variant={noche.disponible ? 'default' : 'filled'}
                fullWidth
                aria-label={`${noche.disponible ? 'Ya no puedo' : 'Puedo trabajar'} esta noche`}
              />
            )}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
