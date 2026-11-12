'use client';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconCalendarEvent,
  IconSearch,
  IconShieldLock,
  IconUserOff,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import { colorDelRol, nombreDelRol } from '@/modules/noche/nombres';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { Cifra } from '@/shared/ui/Cifra';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { paraBuscar } from '@/shared/utilidades/buscar';
import { fechaCorta } from '@/shared/utilidades/fechas';
import { cambiarActivo, crearPersona, editarPersona, restablecerClave } from './acciones';
import type { PersonaDelLocal } from './servicios/personal';

type Dialogo = { tipo: 'nueva' } | { tipo: 'editar' | 'clave'; persona: PersonaDelLocal } | null;

type Filtro = 'todas' | 'activas' | 'administracion' | 'inactivas';

const filtros: Record<Filtro, (persona: PersonaDelLocal) => boolean> = {
  todas: () => true,
  activas: (persona) => persona.activo,
  administracion: (persona) => persona.esAdministrador,
  inactivas: (persona) => !persona.activo,
};

const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');

const CampoClave = ({ etiqueta }: { etiqueta: string }) => (
  <PasswordInput
    name="clave"
    label={etiqueta}
    description="Mínimo 8 caracteres. Se guarda cifrada y no se vuelve a mostrar."
    autoComplete="new-password"
    size="md"
    required
  />
);

function CamposPersona({ persona }: Readonly<{ persona?: PersonaDelLocal }>) {
  return (
    <>
      <TextInput name="nombre" label="Nombre" defaultValue={persona?.nombre} size="md" required />
      <TextInput
        name="correo"
        label="Correo"
        type="email"
        defaultValue={persona?.correo}
        size="md"
        required
      />
      <Checkbox
        name="esAdministrador"
        label="Es administración"
        defaultChecked={persona?.esAdministrador}
      />
    </>
  );
}

function Dato({ etiqueta, valor }: Readonly<{ etiqueta: string; valor: string }>) {
  return (
    <div style={{ minWidth: 0 }}>
      <Text size="xs" c="dimmed">
        {etiqueta}
      </Text>
      <Text size="sm" fw={600}>
        {valor}
      </Text>
    </div>
  );
}

function TarjetaPersona({
  persona,
  alEditar,
  alCambiarClave,
}: Readonly<{ persona: PersonaDelLocal; alEditar: () => void; alCambiarClave: () => void }>) {
  const { principal, proximo } = persona;
  const color = principal ? colorDelRol[principal] : persona.esAdministrador ? 'violeta' : 'gray';
  return (
    <Card
      withBorder
      padding="md"
      style={persona.activo ? undefined : { opacity: 0.65 }}
      aria-label={persona.nombre}
      role="group"
    >
      <Stack gap="md">
        <Group wrap="nowrap" align="flex-start" gap="md">
          <Avatar size={52} radius="xl" color={color} variant="light" fw={700}>
            {iniciales(persona.nombre)}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text fw={700} size="lg" lh={1.25} truncate>
              {persona.nombre}
            </Text>
            <Text size="sm" c="dimmed" truncate>
              {persona.correo}
            </Text>
            <Group gap={6} mt={8}>
              {persona.esAdministrador && (
                <Badge variant="light" leftSection={<IconShieldLock size={12} />} tt="none">
                  Administración
                </Badge>
              )}
              {principal && (
                <Badge variant="dot" color={colorDelRol[principal]} tt="none">
                  Suele ser {nombreDelRol[principal]}
                </Badge>
              )}
              {persona.bloqueado && (
                <Badge color="orange" tt="none">
                  Bloqueada
                </Badge>
              )}
              {!persona.activo && (
                <Badge color="gray" tt="none">
                  Desactivada
                </Badge>
              )}
            </Group>
          </div>
        </Group>

        <SimpleGrid cols={2} spacing="xs">
          <Dato
            etiqueta="Noches trabajadas"
            valor={
              persona.noches === 0
                ? 'Ninguna'
                : `${persona.noches}${persona.ultima ? ` · última ${fechaCorta(persona.ultima)}` : ''}`
            }
          />
          <Dato
            etiqueta="Próximo turno"
            valor={
              proximo
                ? [fechaCorta(proximo.fecha), nombreDelRol[proximo.rol], proximo.ambiente]
                    .filter(Boolean)
                    .join(' · ')
                : 'Sin turno'
            }
          />
        </SimpleGrid>

        <Group gap="xs" grow wrap="nowrap">
          <Button
            variant="default"
            size="sm"
            mih={44}
            px="xs"
            onClick={alEditar}
            aria-label={`Editar a ${persona.nombre}`}
          >
            Editar
          </Button>
          <Button
            variant="default"
            size="sm"
            mih={44}
            px="xs"
            onClick={alCambiarClave}
            aria-label={`Restablecer la contraseña de ${persona.nombre}`}
          >
            Clave
          </Button>
          <BotonAccion
            accion={cambiarActivo}
            datos={persona.activo ? { id: persona.id } : { id: persona.id, activo: 'on' }}
            etiqueta={persona.activo ? 'Desactivar' : 'Activar'}
            variant={persona.activo ? 'subtle' : 'light'}
            color={persona.activo ? 'red' : undefined}
            px="xs"
            fullWidth
            aria-label={`${persona.activo ? 'Desactivar' : 'Activar'} a ${persona.nombre}`}
            confirmar={
              persona.activo
                ? `¿Desactivar a ${persona.nombre}? Sus sesiones se cerrarán de inmediato.`
                : undefined
            }
          />
        </Group>
      </Stack>
    </Card>
  );
}

// HU-03: las cuentas del personal como un directorio. Cada tarjeta muestra lo que la administración
// necesita para decidir: el rol que la persona suele hacer, cuánto ha trabajado y su próximo turno.
export function Personal({ personas }: Readonly<{ personas: PersonaDelLocal[] }>) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const cerrar = () => setDialogo(null);

  const texto = paraBuscar(busqueda.trim());
  const visibles = personas
    .filter(filtros[filtro])
    .filter((p) => !texto || paraBuscar(`${p.nombre} ${p.correo}`).includes(texto))
    .toSorted((a, b) => Number(b.activo) - Number(a.activo));
  const activas = personas.filter((p) => p.activo);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconUsers}
        titulo="Personal"
        descripcion="Solo entran las cuentas creadas aquí."
      >
        <Button
          size="sm"
          mih={44}
          leftSection={<IconUserPlus size={18} />}
          onClick={() => setDialogo({ tipo: 'nueva' })}
        >
          Agregar persona
        </Button>
      </EncabezadoPagina>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Cifra
          compacta
          icono={IconUsers}
          color="violeta"
          etiqueta="Activas"
          valor={String(activas.length)}
        />
        <Cifra
          compacta
          icono={IconShieldLock}
          color="grape"
          etiqueta="Administración"
          valor={String(activas.filter((p) => p.esAdministrador).length)}
        />
        <Cifra
          compacta
          icono={IconCalendarEvent}
          color="green"
          etiqueta="Con turno"
          valor={String(activas.filter((p) => p.proximo).length)}
          detalle="en una noche vigente"
        />
        <Cifra
          compacta
          icono={IconUserOff}
          color="gray"
          etiqueta="Inactivas"
          valor={String(personas.length - activas.length)}
        />
      </SimpleGrid>

      <Stack gap="xs">
        <TextInput
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.currentTarget.value)}
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar personal"
          leftSection={<IconSearch size={18} />}
          size="md"
        />
        <SegmentedControl
          fullWidth
          value={filtro}
          onChange={(valor) => setFiltro(valor as Filtro)}
          aria-label="Mostrar"
          styles={{
            label: {
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
          data={[
            { value: 'todas', label: 'Todas' },
            { value: 'activas', label: 'Activas' },
            { value: 'administracion', label: 'Admin' },
            { value: 'inactivas', label: 'Inactivas' },
          ]}
        />
      </Stack>

      {visibles.length === 0 && <Text c="dimmed">Nadie coincide con la búsqueda.</Text>}
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
        {visibles.map((persona) => (
          <TarjetaPersona
            key={persona.id}
            persona={persona}
            alEditar={() => setDialogo({ tipo: 'editar', persona })}
            alCambiarClave={() => setDialogo({ tipo: 'clave', persona })}
          />
        ))}
      </SimpleGrid>

      <Modal opened={dialogo?.tipo === 'nueva'} onClose={cerrar} title="Agregar persona">
        <FormularioAccion accion={crearPersona} textoEnviar="Crear cuenta" alTerminar={cerrar}>
          <CamposPersona />
          <CampoClave etiqueta="Contraseña inicial" />
        </FormularioAccion>
      </Modal>

      <Modal opened={dialogo?.tipo === 'editar'} onClose={cerrar} title="Editar persona">
        {dialogo?.tipo === 'editar' && (
          <FormularioAccion accion={editarPersona} textoEnviar="Guardar" alTerminar={cerrar}>
            <input type="hidden" name="id" value={dialogo.persona.id} />
            <CamposPersona persona={dialogo.persona} />
          </FormularioAccion>
        )}
      </Modal>

      <Modal opened={dialogo?.tipo === 'clave'} onClose={cerrar} title="Restablecer contraseña">
        {dialogo?.tipo === 'clave' && (
          <FormularioAccion accion={restablecerClave} textoEnviar="Guardar" alTerminar={cerrar}>
            <input type="hidden" name="id" value={dialogo.persona.id} />
            <Text size="sm">{dialogo.persona.nombre}</Text>
            <CampoClave etiqueta="Contraseña nueva" />
          </FormularioAccion>
        )}
      </Modal>
    </Stack>
  );
}
