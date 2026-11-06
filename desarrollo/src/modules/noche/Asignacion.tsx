'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NativeSelect,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Ambiente } from '@/modules/local/repositorios/ambientes';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import { asignarTurno, quitarTurno } from './acciones';
import { nombreDelRol } from './nombres';
import type { Noche } from './repositorios/noches';
import type { Dotacion } from './servicios/turnos';

interface Props {
  noches: Noche[];
  elegida: Noche;
  dotacion: Dotacion;
  ambientes: Ambiente[];
}

const opcionesRol = Object.entries(nombreDelRol).map(([value, label]) => ({ value, label }));

function FormularioTurno({
  fecha,
  persona,
  ambientes,
  alTerminar,
}: Readonly<{
  fecha: string;
  persona: Dotacion[number];
  ambientes: Ambiente[];
  alTerminar: () => void;
}>) {
  const [rol, setRol] = useState(persona.rol ?? 'garzon');

  return (
    <FormularioAccion accion={asignarTurno} textoEnviar="Asignar" alTerminar={alTerminar}>
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="usuarioId" value={persona.id} />
      {!persona.disponible && (
        <Alert color="yellow" variant="light">
          <Stack gap="xs">
            <Text size="sm">{persona.nombre} no declaró disponibilidad para esta noche.</Text>
            <Checkbox name="confirmarSinDisponibilidad" label="Asignar de todos modos" />
          </Stack>
        </Alert>
      )}
      <NativeSelect
        name="rol"
        label="Rol"
        value={rol}
        onChange={(evento) => setRol(evento.currentTarget.value)}
        size="md"
        data={opcionesRol}
      />
      {rol !== 'guardia' && (
        <NativeSelect
          name="ambienteId"
          label="Ambiente"
          defaultValue={String(persona.ambienteId ?? ambientes[0]?.id ?? '')}
          size="md"
          data={ambientes.map((a) => ({ value: String(a.id), label: a.nombre }))}
        />
      )}
    </FormularioAccion>
  );
}

export function Asignacion({ noches, elegida, dotacion, ambientes }: Readonly<Props>) {
  const router = useRouter();
  const [editando, setEditando] = useState<Dotacion[number] | null>(null);
  const cerrar = () => setEditando(null);

  const nombreAmbiente = (id: number | null) => ambientes.find((a) => a.id === id)?.nombre;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Asignar turnos</Title>
        <Text c="dimmed" size="sm">
          Cada persona tiene a lo más un turno por noche.
        </Text>
      </div>

      <NativeSelect
        label="Noche"
        value={elegida.fecha}
        onChange={(evento) => router.push(`/admin/asignacion?fecha=${evento.currentTarget.value}`)}
        size="md"
        data={noches.map((noche) => ({
          value: noche.fecha,
          label: tituloDeFecha(noche.fecha),
        }))}
      />

      {dotacion.map((persona) => (
        <Card key={persona.id} withBorder padding="sm">
          <Group gap="xs">
            <Text fw={600}>{persona.nombre}</Text>
            {persona.disponible ? (
              <Badge color="green" variant="light">
                Disponible
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                No declaró
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {persona.rol
              ? [nombreDelRol[persona.rol], nombreAmbiente(persona.ambienteId)]
                  .filter(Boolean)
                  .join(' · ')
              : 'Sin turno'}
          </Text>
          <Group gap="xs" mt="xs">
            <Button
              variant="default"
              size="sm"
              mih={44}
              onClick={() => setEditando(persona)}
              aria-label={`Asignar turno a ${persona.nombre}`}
            >
              {persona.rol ? 'Cambiar turno' : 'Asignar turno'}
            </Button>
            {persona.rol && (
              <BotonAccion
                accion={quitarTurno}
                datos={{ fecha: elegida.fecha, usuarioId: persona.id }}
                etiqueta="Quitar"
                color="red"
                aria-label={`Quitar el turno de ${persona.nombre}`}
              />
            )}
          </Group>
        </Card>
      ))}

      <Modal opened={editando !== null} onClose={cerrar} title={`Turno de ${editando?.nombre}`}>
        {editando && (
          <FormularioTurno
            fecha={elegida.fecha}
            persona={editando}
            ambientes={ambientes}
            alTerminar={cerrar}
          />
        )}
      </Modal>
    </Stack>
  );
}
