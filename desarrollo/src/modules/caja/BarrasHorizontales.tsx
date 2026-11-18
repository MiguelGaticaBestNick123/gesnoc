'use client';

import { Box, Group, Stack, Text } from '@mantine/core';

// El violeta del tema sobre la superficie de las tarjetas: contraste validado ≥ 3:1.
const COLOR = 'var(--mantine-color-violeta-4)';

export interface FilaBarra {
  etiqueta: string;
  valor: number;
  /** Una línea secundaria, por ejemplo «12 pedidos · $8.000 de propina». */
  detalle?: string;
}

/**
 * Un ranking de una sola serie: cada fila con su nombre, su cifra y una barra proporcional al
 * máximo. Es una lista de texto, así que el lector de pantalla la recorre sin depender del gráfico.
 */
export function BarrasHorizontales({
  filas,
  formato,
  vacio,
}: Readonly<{ filas: FilaBarra[]; formato: (valor: number) => string; vacio: string }>) {
  if (filas.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {vacio}
      </Text>
    );
  }
  const maximo = Math.max(...filas.map((f) => f.valor), 1);

  return (
    <Stack gap="sm" component="ol" m={0} p={0} style={{ listStyle: 'none' }}>
      {filas.map((fila) => (
        <li key={fila.etiqueta}>
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="sm" fw={600} truncate>
              {fila.etiqueta}
            </Text>
            <Text size="sm" fw={700} style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {formato(fila.valor)}
            </Text>
          </Group>
          <Box
            aria-hidden
            mt={4}
            h={8}
            w={`${Math.max(1, (fila.valor / maximo) * 100)}%`}
            style={{ background: COLOR, borderRadius: '0 4px 4px 0' }}
          />
          {fila.detalle && (
            <Text size="xs" c="dimmed" mt={2}>
              {fila.detalle}
            </Text>
          )}
        </li>
      ))}
    </Stack>
  );
}
