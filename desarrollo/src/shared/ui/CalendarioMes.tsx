'use client';

import { ActionIcon, Box, Group, Text, UnstyledButton } from '@mantine/core';
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
      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {DIAS_DE_LA_SEMANA.map((nombre) => (
          <Text key={nombre} size="xs" c="dimmed" ta="center" fw={600} pb={2}>
            {nombre}
          </Text>
        ))}
        {diasDeLaGrilla(mes).map((fecha) => {
          const dia = dias[fecha];
          const elegido = fecha === seleccionado;
          const esHoy = fecha === hoy;
          const color = dia?.color;
          return (
            <UnstyledButton
              key={fecha}
              onClick={() => alElegir(fecha)}
              aria-label={dia?.etiqueta ?? formatearFecha(fecha)}
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
                      : 'var(--mantine-color-dark-5)'
                }`,
                // El tono del día se mezcla con el fondo oscuro: así se distingue cada color
                // (el amarillo de la guardia del naranjo de la cocina) sin encandilar de noche.
                background:
                  color && !dia?.contorno
                    ? `color-mix(in srgb, var(--mantine-color-${color}-6) 32%, var(--mantine-color-dark-6))`
                    : 'var(--mantine-color-dark-6)',
                boxShadow: elegido ? '0 0 0 2px var(--mantine-color-violeta-4)' : undefined,
                opacity: mesDe(fecha) === mes ? 1 : 0.35,
              }}
            >
              <Text
                size="sm"
                fw={esHoy ? 800 : 600}
                c={esHoy ? 'violeta.2' : undefined}
                td={esHoy ? 'underline' : undefined}
                lh={1}
              >
                {Number(fecha.slice(8))}
              </Text>
              {dia?.contenido}
            </UnstyledButton>
          );
        })}
      </Box>
    </Box>
  );
}
