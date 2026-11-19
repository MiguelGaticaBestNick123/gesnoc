'use client';

import { Group, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { componerNota, leerNota, PROMOCIONES, type Promocion } from './nota';

const LARGO_NOTA = 280;

/**
 * Precio de entrada y nota de una noche: los mismos campos al programarla y al editarla. La nota
 * se arma con promociones predeterminadas, cada una hasta una hora, y otra nota libre (pedido del
 * Product Owner, 18 nov); se envía como el texto que lee el equipo.
 */
export function CamposNoche({ precio, nota }: Readonly<{ precio?: number; nota?: string | null }>) {
  const inicial = leerNota(nota);
  const [activas, setActivas] = useState<Partial<Record<Promocion, boolean>>>(() =>
    Object.fromEntries(PROMOCIONES.map(({ clave }) => [clave, clave in inicial.promociones])),
  );
  const [horas, setHoras] = useState<Record<Promocion, string>>(
    () =>
      Object.fromEntries(
        PROMOCIONES.map(({ clave, hora }) => [clave, inicial.promociones[clave] ?? hora]),
      ) as Record<Promocion, string>,
  );
  const [otra, setOtra] = useState(inicial.otra);
  const compuesta = componerNota({
    promociones: Object.fromEntries(
      PROMOCIONES.filter(({ clave }) => activas[clave]).map(({ clave }) => [clave, horas[clave]]),
    ),
    otra,
  });

  return (
    <>
      <CampoPesos
        name="precioEntrada"
        label="Precio de entrada"
        valorInicial={precio}
        size="md"
        required
      />
      <input type="hidden" name="nota" value={compuesta} />
      <Stack gap={0}>
        <Text size="sm" fw={500}>
          Promociones de la noche
        </Text>
        {PROMOCIONES.map(({ clave, texto }) => (
          <Group key={clave} justify="space-between" wrap="nowrap" gap="sm">
            <Switch
              label={texto}
              checked={activas[clave] ?? false}
              onChange={(evento) =>
                setActivas({ ...activas, [clave]: evento.currentTarget.checked })
              }
            />
            <TextInput
              type="time"
              aria-label={`Hora: ${texto}`}
              value={horas[clave]}
              onChange={(evento) => setHoras({ ...horas, [clave]: evento.currentTarget.value })}
              disabled={!activas[clave]}
              w={124}
              style={{ flexShrink: 0 }}
            />
          </Group>
        ))}
      </Stack>
      <Textarea
        label="Otra nota para el equipo"
        description="Por ejemplo, «Llegar a las 21:30»."
        value={otra}
        onChange={(evento) => setOtra(evento.currentTarget.value)}
        maxLength={LARGO_NOTA}
        autosize
        minRows={2}
        size="md"
        error={
          compuesta.length > LARGO_NOTA
            ? `La nota completa admite hasta ${LARGO_NOTA} caracteres`
            : undefined
        }
      />
    </>
  );
}
