'use client';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { cambiarActivo, crearPersona, editarPersona, restablecerClave } from './acciones';
import type { Persona } from './repositorios/usuarios';
import { IconUsers } from '@tabler/icons-react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';

type Dialogo = { tipo: 'nueva' } | { tipo: 'editar' | 'clave'; persona: Persona } | null;

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

function CamposPersona({ persona }: Readonly<{ persona?: Persona }>) {
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

export function Personal({ personas }: Readonly<{ personas: Persona[] }>) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const cerrar = () => setDialogo(null);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconUsers}
        titulo="Personal"
        descripcion="Solo entran las cuentas creadas aquí."
      >
        <Button size="sm" mih={44} onClick={() => setDialogo({ tipo: 'nueva' })}>
          Agregar persona
        </Button>
      </EncabezadoPagina>

      {personas.map((persona) => (
        <Card key={persona.id} withBorder padding="sm">
          <Stack gap="xs">
            <div>
              <Group gap="xs">
                <Text fw={600}>{persona.nombre}</Text>
                {persona.esAdministrador && <Badge variant="light">Administración</Badge>}
                {!persona.activo && <Badge color="gray">Desactivada</Badge>}
                {persona.bloqueado && <Badge color="orange">Bloqueada</Badge>}
              </Group>
              <Text size="sm" c="dimmed">
                {persona.correo}
              </Text>
            </div>
            <Group gap="xs">
              <Button
                variant="default"
                size="sm"
                mih={44}
                onClick={() => setDialogo({ tipo: 'editar', persona })}
                aria-label={`Editar a ${persona.nombre}`}
              >
                Editar
              </Button>
              <Button
                variant="default"
                size="sm"
                mih={44}
                onClick={() => setDialogo({ tipo: 'clave', persona })}
                aria-label={`Restablecer la contraseña de ${persona.nombre}`}
              >
                Contraseña
              </Button>
              <BotonAccion
                accion={cambiarActivo}
                datos={persona.activo ? { id: persona.id } : { id: persona.id, activo: 'on' }}
                etiqueta={persona.activo ? 'Desactivar' : 'Activar'}
                color={persona.activo ? 'red' : undefined}
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
      ))}

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
