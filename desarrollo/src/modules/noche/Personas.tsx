'use client';

import { Badge, Group, SegmentedControl, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { Accion } from '@/shared/ui/accion';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { formatearHora } from '@/shared/utilidades/fechas';
import { formatearDocumento } from '@/shared/utilidades/rut';

/** Una persona que la puerta espera: de una lista o invitada esa noche. */
export interface PersonaEsperada {
  documento: string;
  nombre: string;
  apellido: string;
  /** La hora en que entró la noche que se mira, si ya entró. */
  entroEn: string | null;
}

/** Quien ya entró, con su hora: la puerta lo registró con su documento. */
const marcaDeEntrada = (persona: PersonaEsperada) =>
  persona.entroEn ? (
    <Badge color="green" variant="light" tt="none">
      Entró {formatearHora(persona.entroEn)}
    </Badge>
  ) : null;

export function FilaPersona({
  persona,
  detalle,
  quitar,
}: Readonly<{
  persona: PersonaEsperada;
  detalle?: React.ReactNode;
  /** La acción que la saca de la lista o de la noche, con su pregunta de confirmación. */
  quitar?: { accion: Accion; datos: Record<string, string | number>; confirmar: string };
}>) {
  const nombre = `${persona.nombre} ${persona.apellido}`;
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs" py={4}>
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {nombre}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {formatearDocumento(persona.documento)}
          {detalle}
        </Text>
      </div>
      <Group gap={6} wrap="nowrap">
        {marcaDeEntrada(persona)}
        {quitar && (
          <BotonAccion
            accion={quitar.accion}
            datos={quitar.datos}
            etiqueta="Quitar"
            variant="subtle"
            color="red"
            px="xs"
            aria-label={`Quitar a ${nombre}`}
            confirmar={quitar.confirmar}
          />
        )}
      </Group>
    </Group>
  );
}

/** Documento con su tipo: el guardia y la administración lo eligen, no se adivina (RN-21). */
export function CamposDocumento() {
  const [tipo, setTipo] = useState('rut');
  return (
    <>
      <input type="hidden" name="tipoDocumento" value={tipo} />
      <SegmentedControl
        value={tipo}
        onChange={setTipo}
        aria-label="Tipo de documento"
        data={[
          { value: 'rut', label: 'RUT' },
          { value: 'extranjero', label: 'Extranjero' },
        ]}
      />
      <TextInput
        name="documento"
        label="Documento"
        placeholder={tipo === 'rut' ? '12.345.678-5' : 'Letras y números'}
        size="md"
        required
        autoComplete="off"
      />
      <Group grow>
        <TextInput name="nombre" label="Nombre" size="md" required autoComplete="off" />
        <TextInput name="apellido" label="Apellido" size="md" required autoComplete="off" />
      </Group>
    </>
  );
}
