'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NativeSelect,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import {
  cambiarAmbienteActivo,
  crearAmbiente,
  crearEstacion,
  editarAmbiente,
  editarEstacion,
  eliminarEstacion,
} from './acciones';
import type { Estacion } from './repositorios/ambientes';
import type { AmbienteConEstaciones } from './servicios/ambientes';

type Dialogo =
  | { tipo: 'ambiente'; ambiente?: AmbienteConEstaciones }
  | { tipo: 'estacion'; ambienteId: number; estacion?: Estacion }
  | null;

function CamposAmbiente({ ambiente }: Readonly<{ ambiente?: AmbienteConEstaciones }>) {
  return (
    <>
      <TextInput name="nombre" label="Nombre" defaultValue={ambiente?.nombre} size="md" required />
      <Group grow>
        <TextInput
          name="planoAncho"
          label="Ancho del plano"
          type="number"
          inputMode="numeric"
          defaultValue={ambiente?.planoAncho ?? 900}
          size="md"
          required
        />
        <TextInput
          name="planoAlto"
          label="Alto del plano"
          type="number"
          inputMode="numeric"
          defaultValue={ambiente?.planoAlto ?? 440}
          size="md"
          required
        />
      </Group>
    </>
  );
}

function CamposEstacion({ estacion }: Readonly<{ estacion?: Estacion }>) {
  return (
    <>
      <TextInput name="nombre" label="Nombre" defaultValue={estacion?.nombre} size="md" required />
      <NativeSelect
        name="tipo"
        label="Tipo"
        defaultValue={estacion?.tipo ?? 'barra'}
        size="md"
        data={[
          { value: 'barra', label: 'Barra' },
          { value: 'cocina', label: 'Cocina' },
        ]}
      />
    </>
  );
}

export function Ambientes({ ambientes }: Readonly<{ ambientes: AmbienteConEstaciones[] }>) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const cerrar = () => setDialogo(null);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Ambientes y estaciones</Title>
          <Text c="dimmed" size="sm">
            Cada pedido llega a la barra o cocina que lo prepara.
          </Text>
        </div>
        <Button size="sm" mih={44} onClick={() => setDialogo({ tipo: 'ambiente' })}>
          Agregar ambiente
        </Button>
      </Group>

      {ambientes.map((ambiente) => (
        <Card key={ambiente.id} withBorder padding="sm">
          <Stack gap="sm">
            <div>
              <Group gap="xs">
                <Title order={3} size="h4">
                  {ambiente.nombre}
                </Title>
                {!ambiente.activo && <Badge color="gray">Desactivado</Badge>}
              </Group>
              <Text size="sm" c="dimmed">
                Plano de {ambiente.planoAncho} × {ambiente.planoAlto}
              </Text>
            </div>

            <Stack gap={4}>
              {ambiente.estaciones.length === 0 && (
                <Text size="sm" c="dimmed">
                  Sin estaciones
                </Text>
              )}
              {ambiente.estaciones.map((estacion) => (
                <Group key={estacion.id} justify="space-between" wrap="nowrap">
                  <Group gap="xs">
                    <Text size="sm">{estacion.nombre}</Text>
                    <Badge variant="light" color={estacion.tipo === 'barra' ? 'violet' : 'teal'}>
                      {estacion.tipo === 'barra' ? 'Barra' : 'Cocina'}
                    </Badge>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <Button
                      variant="subtle"
                      size="sm"
                      mih={44}
                      onClick={() =>
                        setDialogo({ tipo: 'estacion', ambienteId: ambiente.id, estacion })
                      }
                      aria-label={`Editar ${estacion.nombre}`}
                    >
                      Editar
                    </Button>
                    <BotonAccion
                      accion={eliminarEstacion}
                      datos={{ id: estacion.id }}
                      etiqueta="Eliminar"
                      variant="subtle"
                      color="red"
                      aria-label={`Eliminar ${estacion.nombre}`}
                      confirmar={`¿Eliminar ${estacion.nombre}?`}
                    />
                  </Group>
                </Group>
              ))}
            </Stack>

            <Group gap="xs">
              <Button
                variant="default"
                size="sm"
                mih={44}
                onClick={() => setDialogo({ tipo: 'ambiente', ambiente })}
                aria-label={`Editar ${ambiente.nombre}`}
              >
                Editar
              </Button>
              <Button
                variant="default"
                size="sm"
                mih={44}
                onClick={() => setDialogo({ tipo: 'estacion', ambienteId: ambiente.id })}
                aria-label={`Agregar estación a ${ambiente.nombre}`}
              >
                Agregar estación
              </Button>
              <BotonAccion
                accion={cambiarAmbienteActivo}
                datos={ambiente.activo ? { id: ambiente.id } : { id: ambiente.id, activo: 'on' }}
                etiqueta={ambiente.activo ? 'Desactivar' : 'Activar'}
                color={ambiente.activo ? 'red' : undefined}
                aria-label={`${ambiente.activo ? 'Desactivar' : 'Activar'} ${ambiente.nombre}`}
              />
            </Group>
          </Stack>
        </Card>
      ))}

      <Modal
        opened={dialogo?.tipo === 'ambiente'}
        onClose={cerrar}
        title={
          dialogo?.tipo === 'ambiente' && dialogo.ambiente ? 'Editar ambiente' : 'Agregar ambiente'
        }
      >
        {dialogo?.tipo === 'ambiente' && (
          <FormularioAccion
            accion={dialogo.ambiente ? editarAmbiente : crearAmbiente}
            textoEnviar="Guardar"
            alTerminar={cerrar}
          >
            {dialogo.ambiente && <input type="hidden" name="id" value={dialogo.ambiente.id} />}
            <CamposAmbiente ambiente={dialogo.ambiente} />
          </FormularioAccion>
        )}
      </Modal>

      <Modal
        opened={dialogo?.tipo === 'estacion'}
        onClose={cerrar}
        title={
          dialogo?.tipo === 'estacion' && dialogo.estacion ? 'Editar estación' : 'Agregar estación'
        }
      >
        {dialogo?.tipo === 'estacion' && (
          <FormularioAccion
            accion={dialogo.estacion ? editarEstacion : crearEstacion}
            textoEnviar="Guardar"
            alTerminar={cerrar}
          >
            {dialogo.estacion ? (
              <input type="hidden" name="id" value={dialogo.estacion.id} />
            ) : (
              <input type="hidden" name="ambienteId" value={dialogo.ambienteId} />
            )}
            <CamposEstacion estacion={dialogo.estacion} />
          </FormularioAccion>
        )}
      </Modal>
    </Stack>
  );
}
