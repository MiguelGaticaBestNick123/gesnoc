'use client';

import { Box, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import type { PuntoPorHora } from './indicadores';

const ALTO = 150;
// El violeta del tema (violeta.4) sobre la superficie de las tarjetas: contraste validado ≥ 3:1.
const COLOR = 'var(--mantine-color-violeta-4)';

/**
 * Columnas de una sola serie a lo largo de la noche. Una sola serie no lleva leyenda (el título la
 * nombra); solo la columna más alta lleva su cifra, el resto se lee al tocarla o pasar el mouse, y
 * la misma información está en la tabla para quien no ve el gráfico.
 */
export function ColumnasPorHora({
  titulo,
  puntos,
  formato,
}: Readonly<{ titulo: string; puntos: PuntoPorHora[]; formato: (valor: number) => string }>) {
  if (puntos.every((p) => p.total === 0)) {
    return (
      <Text size="sm" c="dimmed">
        Sin datos esta noche.
      </Text>
    );
  }
  const maximo = Math.max(...puntos.map((p) => p.total));
  const mayor = puntos.findIndex((p) => p.total === maximo);
  // Con pocas horas se lee «23:00»; con muchas, en un teléfono angosto, solo «23» y una sí y otra no.
  const salto = puntos.length > 8 ? 2 : 1;

  return (
    <div>
      <Box
        role="group"
        aria-label={`${titulo}: la hora más alta fue ${puntos[mayor]!.etiqueta}, con ${formato(maximo)}`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: ALTO + 20 }}
      >
        {puntos.map((punto, i) => {
          const alto = punto.total === 0 ? 0 : Math.max(2, (punto.total / maximo) * ALTO);
          return (
            <Tooltip
              key={punto.hora}
              label={`${punto.etiqueta}: ${formato(punto.total)}`}
              events={{ hover: true, focus: true, touch: true }}
              withArrow
            >
              {/* La zona que responde es toda la columna, más grande que la barra. */}
              <UnstyledButton
                aria-label={`${punto.etiqueta}: ${formato(punto.total)}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                {i === mayor && (
                  <Text size="xs" fw={700} mb={2} style={{ whiteSpace: 'nowrap' }}>
                    {formato(punto.total)}
                  </Text>
                )}
                <div
                  style={{
                    width: '100%',
                    maxWidth: 36,
                    height: alto,
                    background: COLOR,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              </UnstyledButton>
            </Tooltip>
          );
        })}
      </Box>
      <div
        aria-hidden
        style={{
          display: 'flex',
          gap: 2,
          borderTop: '1px solid var(--mantine-color-dark-4)',
          paddingTop: 4,
        }}
      >
        {puntos.map((punto, i) => (
          <Text key={punto.hora} size="xs" c="dimmed" ta="center" style={{ flex: 1, minWidth: 0 }}>
            {i % salto !== 0 ? '' : salto === 1 ? punto.etiqueta : punto.etiqueta.slice(0, 2)}
          </Text>
        ))}
      </div>
      <details style={{ marginTop: 8 }}>
        <summary>
          <Text component="span" size="sm" c="dimmed">
            Ver como tabla
          </Text>
        </summary>
        <Table mt="xs" striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Hora</Table.Th>
              <Table.Th ta="right">{titulo}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {puntos.map((punto) => (
              <Table.Tr key={punto.hora}>
                <Table.Td>{punto.etiqueta}</Table.Td>
                <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formato(punto.total)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </details>
    </div>
  );
}
