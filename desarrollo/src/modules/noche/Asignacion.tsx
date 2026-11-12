'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  NativeSelect,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { IconStarFilled, IconUserCheck } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Ambiente } from '@/modules/local/repositorios/ambientes';
import type { RolTurno } from '@/shared/autorizacion';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import { asignarTurno, quitarTurno } from './acciones';
import { colorDelRol, nombreDelRol } from './nombres';
import { ordenarParaRol } from './recomendacion';
import type { Noche } from './repositorios/noches';
import type { Dotacion } from './servicios/turnos';

type Persona = Dotacion[number];

interface Props {
  noches: Noche[];
  elegida: Noche;
  dotacion: Dotacion;
  ambientes: Ambiente[];
}

const roles = Object.keys(nombreDelRol) as RolTurno[];
const opcionesRol = roles.map((value) => ({ value, label: nombreDelRol[value]! }));

function FormularioTurno({
  fecha,
  persona,
  rolInicial,
  ambientes,
  alTerminar,
}: Readonly<{
  fecha: string;
  persona: Persona;
  rolInicial: RolTurno;
  ambientes: Ambiente[];
  alTerminar: () => void;
}>) {
  const [rol, setRol] = useState<RolTurno>(persona.rol ?? rolInicial);

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
        onChange={(evento) => setRol(evento.currentTarget.value as RolTurno)}
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

/** Cuántas personas tiene cada rol esta noche y en qué ambiente. */
function ResumenDotacion({
  dotacion,
  ambientes,
}: Readonly<{ dotacion: Dotacion; ambientes: Ambiente[] }>) {
  return (
    <Group gap="xs">
      {roles.map((rol) => {
        const delRol = dotacion.filter((p) => p.rol === rol);
        const detalle =
          rol === 'guardia'
            ? String(delRol.length)
            : ambientes
                .map((a) => `${a.nombre} ${delRol.filter((p) => p.ambienteId === a.id).length}`)
                .join(' · ');
        return (
          <Badge key={rol} size="lg" variant="light" color={colorDelRol[rol]} tt="none">
            {nombreDelRol[rol]}: {detalle}
          </Badge>
        );
      })}
    </Group>
  );
}

function TarjetaPersona({
  persona,
  rol,
  habitual,
  fecha,
  ambientes,
  alEditar,
}: Readonly<{
  persona: Persona;
  rol: RolTurno;
  habitual: boolean;
  fecha: string;
  ambientes: Ambiente[];
  alEditar: () => void;
}>) {
  const nombreAmbiente = ambientes.find((a) => a.id === persona.ambienteId)?.nombre;
  // HU-10 CA2: sin disponibilidad declarada se pregunta antes de asignar.
  const confirmar = persona.disponible
    ? undefined
    : `${persona.nombre} no declaró disponibilidad para esta noche. ¿Asignar de todos modos?`;
  const datos = {
    fecha,
    usuarioId: persona.id,
    rol,
    ...(persona.disponible ? {} : { confirmarSinDisponibilidad: 'on' }),
  };
  const veces = persona.veces[rol] ?? 0;

  return (
    <Card
      withBorder
      padding="sm"
      style={habitual ? { borderColor: `var(--mantine-color-${colorDelRol[rol]}-7)` } : undefined}
    >
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
        {persona.principal && (
          <Badge
            color={colorDelRol[persona.principal]}
            variant={habitual ? 'filled' : 'light'}
            leftSection={habitual ? <IconStarFilled size={10} /> : undefined}
            tt="none"
          >
            Suele ser {nombreDelRol[persona.principal]}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        {persona.rol
          ? [nombreDelRol[persona.rol], nombreAmbiente].filter(Boolean).join(' · ')
          : 'Sin turno'}
      </Text>
      {veces > 0 && (
        <Text size="xs" c="dimmed">
          {veces} {veces === 1 ? 'noche' : 'noches'} de {nombreDelRol[rol]}
        </Text>
      )}
      <Group gap="xs" mt="xs">
        {rol === 'guardia'
          ? persona.rol !== 'guardia' && (
              <BotonAccion
                accion={asignarTurno}
                datos={datos}
                etiqueta="Asignar como guardia"
                confirmar={confirmar}
                aria-label={`Asignar a ${persona.nombre} como Guardia`}
              />
            )
          : ambientes.map((ambiente) =>
              persona.rol === rol && persona.ambienteId === ambiente.id ? (
                <Badge key={ambiente.id} size="lg" color={colorDelRol[rol]} tt="none">
                  ✓ {ambiente.nombre}
                </Badge>
              ) : (
                <BotonAccion
                  key={ambiente.id}
                  accion={asignarTurno}
                  datos={{ ...datos, ambienteId: ambiente.id }}
                  etiqueta={ambiente.nombre}
                  confirmar={confirmar}
                  aria-label={`Asignar a ${persona.nombre} como ${nombreDelRol[rol]} en ${ambiente.nombre}`}
                />
              ),
            )}
        <Button
          variant="default"
          size="sm"
          mih={44}
          onClick={alEditar}
          aria-label={`Asignar turno a ${persona.nombre}`}
        >
          {persona.rol ? 'Cambiar turno' : 'Más opciones'}
        </Button>
        {persona.rol && (
          <BotonAccion
            accion={quitarTurno}
            datos={{ fecha, usuarioId: persona.id }}
            etiqueta="Quitar"
            color="red"
            aria-label={`Quitar el turno de ${persona.nombre}`}
          />
        )}
      </Group>
    </Card>
  );
}

// HU-10: asignar rol y ambiente de la noche. El rol cambia de una noche a otra; al elegir el que se
// va a asignar, arriba aparecen quienes lo hacen habitualmente y abajo todas las demás personas.
export function Asignacion({ noches, elegida, dotacion, ambientes }: Readonly<Props>) {
  const router = useRouter();
  const [rol, setRol] = useState<RolTurno>('garzon');
  const [editando, setEditando] = useState<Persona | null>(null);
  const cerrar = () => setEditando(null);
  const { habituales, otras } = ordenarParaRol(dotacion, rol);

  const tarjeta = (persona: Persona, habitual: boolean) => (
    <TarjetaPersona
      key={persona.id}
      persona={persona}
      rol={rol}
      habitual={habitual}
      fecha={elegida.fecha}
      ambientes={ambientes}
      alEditar={() => setEditando(persona)}
    />
  );

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconUserCheck}
        titulo="Asignar turnos"
        descripcion="Cada persona tiene a lo más un turno por noche. Garzón y barra llevan ambiente: con él se reparten las propinas."
      />

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

      <ResumenDotacion dotacion={dotacion} ambientes={ambientes} />

      <div>
        <Text size="sm" fw={500} mb={4}>
          Rol que vas a asignar
        </Text>
        <SegmentedControl
          fullWidth
          value={rol}
          onChange={(valor) => setRol(valor as RolTurno)}
          data={opcionesRol}
        />
      </div>

      {habituales.length > 0 && (
        <Text size="sm" c="dimmed">
          Suelen hacer de {nombreDelRol[rol]}:
        </Text>
      )}
      {habituales.map((persona) => tarjeta(persona, true))}
      {otras.length > 0 && <Divider label="Otros roles" labelPosition="center" />}
      {otras.map((persona) => tarjeta(persona, false))}

      <Modal opened={editando !== null} onClose={cerrar} title={`Turno de ${editando?.nombre}`}>
        {editando && (
          <FormularioTurno
            fecha={elegida.fecha}
            persona={editando}
            rolInicial={rol}
            ambientes={ambientes}
            alTerminar={cerrar}
          />
        )}
      </Modal>
    </Stack>
  );
}
