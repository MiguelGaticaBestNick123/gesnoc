'use client';

import { ActionIcon, Box, Group, Text, UnstyledButton, VisuallyHidden } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import {
  DIAS_DE_LA_SEMANA,
  diasDeLaGrilla,
  mesDe,
  mesSiguiente,
  tituloDeMes,
} from '@/shared/utilidades/calendario';
import { formatearFecha } from '@/shared/utilidades/fechas';

export interface DiaDelCalendario {
  /** Nombre accesible del día con su estado, por ejemplo «sábado, 14 de noviembre, programada». */
  etiqueta: string;
  /** Color de Mantine con que se destaca el día. */
  color?: string;
  /** Solo el borde punteado, sin relleno: algo que todavía se puede hacer (por ejemplo, postular). */
  contorno?: boolean;
  /** Lo que se dibuja en la celda bajo el número: personas, puntos o un texto corto. */
  contenido?: React.ReactNode;
}

interface Props {
  mes: string;
  hoy: string;
  /** Ruta del mismo calendario para otro mes. */
  rutaDelMes: (mes: string) => string;
  dias: Record<string, DiaDelCalendario>;
  seleccionado?: string | null;
  alElegir: (fecha: string) => void;
}

/** Calendario de un mes, de lunes a domingo. Cada día es un botón que abre su detalle. */
export function CalendarioMes({
  mes,
  hoy,
  rutaDelMes,
  dias,
  seleccionado = null,
  alElegir,
}: Readonly<Props>) {
  return (
    <Box>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <ActionIcon
          component={Link}
          href={rutaDelMes(mesSiguiente(mes, -1))}
          size={44}
          variant="default"
          aria-label="Mes anterior"
        >
          <IconChevronLeft size={20} />
        </ActionIcon>
        <Text fw={700} size="xl">
          {tituloDeMes(mes)}
        </Text>
        <ActionIcon
          component={Link}
          href={rutaDelMes(mesSiguiente(mes, 1))}
          size={44}
          variant="default"
          aria-label="Mes siguiente"
        >
          <IconChevronRight size={20} />
        </ActionIcon>
      </Group>
      {/* El espacio entre días se achica en el teléfono: así cada día mide 44 px de ancho (RNF-09). */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 'clamp(2px, 0.6vw, 4px)',
        }}
      >
        {DIAS_DE_LA_SEMANA.map((nombre) => (
          <Text key={nombre} size="xs" c="dimmed" ta="center" fw={600} pb={2}>
            {nombre}
          </Text>
        ))}
        {diasDeLaGrilla(mes).map((fecha) => {
          const dia = dias[fecha];
          const elegido = fecha === seleccionado;
          const esHoy = fecha === hoy;
          const delMes = mesDe(fecha) === mes;
          const color = delMes ? dia?.color : undefined;
          return (
            <UnstyledButton
              key={fecha}
              onClick={() => alElegir(fecha)}
              aria-pressed={elegido}
              mih={{ base: 58, sm: 96 }}
              p={6}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 0,
                overflow: 'hidden',
                borderRadius: 'var(--mantine-radius-md)',
                border: `1px ${dia?.contorno ? 'dashed' : 'solid'} ${
                  elegido
                    ? 'var(--mantine-color-violeta-3)'
                    : color
                      ? `var(--mantine-color-${color}-${dia?.contorno ? 4 : 6})`
                      : `var(--mantine-color-dark-${delMes ? 5 : 6})`
                }`,
                // El tono del día se mezcla con el fondo oscuro: así se distingue cada color
                // (el amarillo de la guardia del naranjo de la cocina) sin encandilar de noche. Los
                // días de otro mes van sin relleno y con el número atenuado, que igual se lee (WCAG).
                background:
                  color && !dia?.contorno
                    ? `color-mix(in srgb, var(--mantine-color-${color}-6) 32%, var(--mantine-color-dark-6))`
                    : delMes
                      ? 'var(--mantine-color-dark-6)'
                      : 'transparent',
                boxShadow: elegido ? '0 0 0 2px var(--mantine-color-violeta-4)' : undefined,
              }}
            >
              {/* El nombre accesible es la descripción completa del día; el número y las marcas
                  son su versión visual. */}
              <VisuallyHidden>{dia?.etiqueta ?? formatearFecha(fecha)}</VisuallyHidden>
              <Text
                aria-hidden
                size="sm"
                fw={esHoy ? 800 : 600}
                c={esHoy ? 'violeta.1' : delMes ? undefined : 'dimmed'}
                td={esHoy ? 'underline' : undefined}
                lh={1}
              >
                {Number(fecha.slice(8))}
              </Text>
              {dia?.contenido && (
                <Box aria-hidden style={{ opacity: delMes ? 1 : 0.6 }}>
                  {dia.contenido}
                </Box>
              )}
            </UnstyledButton>
          );
        })}
      </Box>
    </Box>
  );
}
