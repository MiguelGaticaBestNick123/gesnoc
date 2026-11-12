'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBottle,
  IconBuildingStore,
  IconChefHat,
  IconPlus,
  type Icon,
} from '@tabler/icons-react';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
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
import type { AmbienteConBarra, LocalConEstaciones } from './servicios/ambientes';

type Dialogo =
  | { tipo: 'ambiente'; ambiente?: AmbienteConBarra }
  | { tipo: 'barra'; ambiente: AmbienteConBarra }
  | { tipo: 'cocina' }
  | { tipo: 'renombrar'; estacion: Estacion }
  | null;

function CamposAmbiente({ ambiente }: Readonly<{ ambiente?: AmbienteConBarra }>) {
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

const etiqueta = (texto: string) => (
  <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={0.5}>
    {texto}
  </Text>
);

/** Una estación con su ícono, para renombrarla o eliminarla. */
function FilaEstacion({
  estacion,
  icono: Icono,
  color,
  alRenombrar,
}: Readonly<{ estacion: Estacion; icono: Icon; color: string; alRenombrar: () => void }>) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <ThemeIcon variant="light" color={color} size={36} radius="md">
          <Icono size={20} />
        </ThemeIcon>
        <Text fw={600} truncate>
          {estacion.nombre}
        </Text>
      </Group>
      <Group gap={4} wrap="nowrap">
        <Button
          variant="subtle"
          size="sm"
          mih={44}
          px="xs"
          onClick={alRenombrar}
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
          px="xs"
          aria-label={`Eliminar ${estacion.nombre}`}
          confirmar={`¿Eliminar ${estacion.nombre}?`}
        />
      </Group>
    </Group>
  );
}

// HU-04: los ambientes, cada uno con su barra (RN-27), y la cocina, que es de todo el local: recibe
// la comida de los pedidos de todos los ambientes (decisión del Product Owner, 12 nov).
export function Ambientes({ local }: Readonly<{ local: LocalConEstaciones }>) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const cerrar = () => setDialogo(null);
  const nuevaEstacion = dialogo?.tipo === 'barra' || dialogo?.tipo === 'cocina' ? dialogo : null;

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconBuildingStore}
        titulo="Ambientes y estaciones"
        descripcion="Cada ambiente tiene su barra. La cocina es de todo el local: recibe la comida de todos los ambientes."
      >
        <Button size="sm" mih={44} onClick={() => setDialogo({ tipo: 'ambiente' })}>
          Agregar ambiente
        </Button>
      </EncabezadoPagina>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {local.ambientes.map((ambiente) => (
          <Card key={ambiente.id} withBorder padding="md">
            <Stack gap="md">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" size={44} radius="md">
                  <IconBuildingStore size={24} />
                </ThemeIcon>
                <div style={{ minWidth: 0 }}>
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
              </Group>

              <Stack gap={6}>
                {etiqueta('Barra')}
                {ambiente.barra ? (
                  <FilaEstacion
                    estacion={ambiente.barra}
                    icono={IconBottle}
                    color="blue"
                    alRenombrar={() =>
                      ambiente.barra && setDialogo({ tipo: 'renombrar', estacion: ambiente.barra })
                    }
                  />
                ) : (
                  <Group justify="space-between" gap="xs">
                    <Text size="sm" c="yellow.4">
                      Sin barra: sus tragos no se pueden pedir.
                    </Text>
                    <Button
                      size="sm"
                      mih={44}
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={() => setDialogo({ tipo: 'barra', ambiente })}
                      aria-label={`Agregar barra a ${ambiente.nombre}`}
                    >
                      Agregar barra
                    </Button>
                  </Group>
                )}
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
                <BotonAccion
                  accion={cambiarAmbienteActivo}
                  datos={ambiente.activo ? { id: ambiente.id } : { id: ambiente.id, activo: 'on' }}
                  etiqueta={ambiente.activo ? 'Desactivar' : 'Activar'}
                  variant="default"
                  color={ambiente.activo ? 'red' : undefined}
                  aria-label={`${ambiente.activo ? 'Desactivar' : 'Activar'} ${ambiente.nombre}`}
                  confirmar={
                    ambiente.activo
                      ? `¿Desactivar ${ambiente.nombre}? Sus mesas dejan de verse en el mapa.`
                      : undefined
                  }
                />
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder padding="md">
        <Stack gap="md">
          <Group justify="space-between" gap="sm">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="orange" size={44} radius="md">
                <IconChefHat size={24} />
              </ThemeIcon>
              <div>
                <Title order={3} size="h4">
                  Cocina
                </Title>
                <Text size="sm" c="dimmed">
                  De todo el local: recibe la comida de todos los ambientes.
                </Text>
              </div>
            </Group>
            <Button
              size="sm"
              mih={44}
              variant="light"
              color="orange"
              leftSection={<IconPlus size={16} />}
              onClick={() => setDialogo({ tipo: 'cocina' })}
            >
              Agregar cocina
            </Button>
          </Group>
          {local.cocinas.length === 0 && (
            <Text size="sm" c="yellow.4">
              Sin cocina: la comida no se puede pedir.
            </Text>
          )}
          {local.cocinas.map((cocina) => (
            <FilaEstacion
              key={cocina.id}
              estacion={cocina}
              icono={IconChefHat}
              color="orange"
              alRenombrar={() => setDialogo({ tipo: 'renombrar', estacion: cocina })}
            />
          ))}
        </Stack>
      </Card>

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
        opened={nuevaEstacion !== null}
        onClose={cerrar}
        title={
          nuevaEstacion?.tipo === 'barra'
            ? `Agregar barra a ${nuevaEstacion.ambiente.nombre}`
            : 'Agregar cocina'
        }
      >
        {nuevaEstacion && (
          <FormularioAccion accion={crearEstacion} textoEnviar="Guardar" alTerminar={cerrar}>
            <input type="hidden" name="tipo" value={nuevaEstacion.tipo} />
            {nuevaEstacion.tipo === 'barra' && (
              <input type="hidden" name="ambienteId" value={nuevaEstacion.ambiente.id} />
            )}
            <TextInput
              name="nombre"
              label="Nombre"
              placeholder={
                nuevaEstacion.tipo === 'barra' ? `Barra ${nuevaEstacion.ambiente.nombre}` : 'Cocina'
              }
              size="md"
              required
            />
          </FormularioAccion>
        )}
      </Modal>

      <Modal opened={dialogo?.tipo === 'renombrar'} onClose={cerrar} title="Editar estación">
        {dialogo?.tipo === 'renombrar' && (
          <FormularioAccion accion={editarEstacion} textoEnviar="Guardar" alTerminar={cerrar}>
            <input type="hidden" name="id" value={dialogo.estacion.id} />
            <TextInput
              name="nombre"
              label="Nombre"
              defaultValue={dialogo.estacion.nombre}
              size="md"
              required
            />
          </FormularioAccion>
        )}
      </Modal>
    </Stack>
  );
}
