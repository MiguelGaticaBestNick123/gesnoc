'use client';

import { Badge, Button, Card, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearFecha, tituloDeFecha } from '@/shared/utilidades/fechas';
import { editarNoche, eliminarNoche, programarNoche } from './acciones';
import type { Noche } from './repositorios/noches';
import { IconCalendarEvent } from '@tabler/icons-react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';

type Dialogo = { noche?: Noche } | null;

const estadoDe = (noche: Noche) => {
  if (noche.cerradaEn) return { texto: 'Cerrada', color: 'gray' };
  if (noche.abiertaEn) return { texto: 'Abierta', color: 'green' };
  return { texto: 'Programada', color: 'violet' };
};

function CamposNoche({ noche }: Readonly<{ noche?: Noche }>) {
  return (
    <>
      {noche ? (
        <>
          <input type="hidden" name="fecha" value={noche.fecha} />
          <Text fw={600}>{tituloDeFecha(noche.fecha)}</Text>
        </>
      ) : (
        <TextInput name="fecha" label="Fecha operativa" type="date" size="md" required />
      )}
      <CampoPesos
        name="precioEntrada"
        label="Precio de entrada"
        valorInicial={noche?.precioEntrada}
        size="md"
        required
      />
      <Textarea
        name="nota"
        label="Nota para el equipo"
        defaultValue={noche?.nota ?? ''}
        maxLength={280}
        autosize
        minRows={2}
        size="md"
      />
    </>
  );
}

export function Calendario({ noches }: Readonly<{ noches: Noche[] }>) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const cerrar = () => setDialogo(null);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconCalendarEvent}
        titulo="Calendario de noches"
        descripcion="La fecha operativa se fija aquí y no cambia aunque la noche termine de madrugada."
      >
        <Button size="sm" mih={44} onClick={() => setDialogo({})}>
          Programar noche
        </Button>
      </EncabezadoPagina>

      {noches.length === 0 && <Text c="dimmed">Todavía no hay noches programadas.</Text>}

      {noches.map((noche) => {
        const estado = estadoDe(noche);
        return (
          <Card key={noche.fecha} withBorder padding="sm">
            <Group gap="xs">
              <Text fw={600}>{tituloDeFecha(noche.fecha)}</Text>
              <Badge color={estado.color} variant="light">
                {estado.texto}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Entrada {formatearPesos(noche.precioEntrada)} · {noche.disponibles} disponibles ·{' '}
              {noche.asignados} con turno
            </Text>
            {noche.nota && <Text size="sm">{noche.nota}</Text>}
            {!noche.cerradaEn && (
              <Group gap="xs" mt="xs">
                <Button
                  variant="default"
                  size="sm"
                  mih={44}
                  onClick={() => setDialogo({ noche })}
                  aria-label={`Editar la noche del ${formatearFecha(noche.fecha)}`}
                >
                  Editar
                </Button>
                {!noche.abiertaEn && (
                  <BotonAccion
                    accion={eliminarNoche}
                    datos={{ fecha: noche.fecha }}
                    etiqueta="Eliminar"
                    color="red"
                    aria-label={`Eliminar la noche del ${formatearFecha(noche.fecha)}`}
                    confirmar={`¿Eliminar la noche del ${formatearFecha(noche.fecha)}? Se pierden su disponibilidad y sus turnos.`}
                  />
                )}
              </Group>
            )}
          </Card>
        );
      })}

      <Modal
        opened={dialogo !== null}
        onClose={cerrar}
        title={dialogo?.noche ? 'Editar noche' : 'Programar noche'}
      >
        {dialogo && (
          <FormularioAccion
            accion={dialogo.noche ? editarNoche : programarNoche}
            textoEnviar="Guardar"
            alTerminar={cerrar}
          >
            <CamposNoche noche={dialogo.noche} />
          </FormularioAccion>
        )}
      </Modal>
    </Stack>
  );
}
