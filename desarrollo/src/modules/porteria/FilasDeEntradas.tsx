import { Badge, Group, Stack, Text } from '@mantine/core';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { plural } from '@/shared/utilidades/texto';
import { FORMAS_DE_ENTRADA, formaDe, formas } from './formas';

export interface EntradasPorForma {
  medio: string | null;
  personas: number;
  monto: number;
}

/** Las entradas de la noche por forma (EF, RC, PN y gratis), con el monto: solo para la administración. */
export function FilasDeEntradas({ entradas }: Readonly<{ entradas: EntradasPorForma[] }>) {
  return (
    <Stack gap={6}>
      {FORMAS_DE_ENTRADA.map((forma) => {
        const fila = entradas.find((e) => formaDe(e.medio) === forma);
        return (
          <Group key={forma} justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Badge color={formas[forma].color} variant="light" w={64} tt="none">
                {formas[forma].codigo}
              </Badge>
              <Text size="sm">{plural(fila?.personas ?? 0, 'persona', 'personas')}</Text>
            </Group>
            <Text size="sm" fw={600}>
              {forma === 'gratis' ? '—' : formatearPesos(fila?.monto ?? 0)}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );
}
