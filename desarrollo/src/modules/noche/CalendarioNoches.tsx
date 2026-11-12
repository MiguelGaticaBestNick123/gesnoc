'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCalendarEvent, IconUserCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { CalendarioMes, type DiaDelCalendario } from '@/shared/ui/CalendarioMes';
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { mesDe } from '@/shared/utilidades/calendario';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearFecha, tituloDeFecha } from '@/shared/utilidades/fechas';
import { editarNoche, eliminarNoche, programarNoche } from './acciones';
import { colorDelRol, nombreDelRol } from './nombres';
import type { EstadoNoche } from './repositorios/noches';
import type { CalendarioDelMes, NocheDelCalendario } from './servicios/noches';

const estados: Record<EstadoNoche, { texto: string; color: string }> = {
  programada: { texto: 'Programada', color: 'violeta' },
  abierta: { texto: 'Abierta', color: 'green' },
  cerrada: { texto: 'Cerrada', color: 'gray' },
};

const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');

const ruta = (mes: string, dia?: string) =>
  `/admin/calendario?mes=${mes}${dia ? `&dia=${dia}` : ''}`;

/** Personas con turno dentro de la celda: iniciales en el color de su rol (puntos en el teléfono). */
function PersonasDelDia({ noche }: Readonly<{ noche: NocheDelCalendario }>) {
  const visibles = noche.turnos.slice(0, 4);
  const resto = noche.turnos.length - visibles.length;
  return (
    <>
      <Group gap={3} visibleFrom="sm">
        {visibles.map((turno) => (
          <Badge
            key={turno.usuarioId}
            size="xs"
            radius="sm"
            variant="filled"
            color={colorDelRol[turno.rol]}
            px={4}
          >
            {iniciales(turno.nombre)}
          </Badge>
        ))}
        {resto > 0 && (
          <Text size="xs" c="dimmed">
            +{resto}
          </Text>
        )}
      </Group>
      <Group gap={3} hiddenFrom="sm">
        {noche.turnos.slice(0, 6).map((turno) => (
          <Box
            key={turno.usuarioId}
            w={7}
            h={7}
            style={{
              borderRadius: '50%',
              background: `var(--mantine-color-${colorDelRol[turno.rol]}-5)`,
            }}
          />
        ))}
      </Group>
      {noche.estado === 'programada' && noche.postulantes.length > 0 && (
        <Text size="xs" c="dimmed" lh={1.1} visibleFrom="sm">
          {noche.postulantes.length} postulan
        </Text>
      )}
    </>
  );
}

function CamposNoche({ precio, nota }: Readonly<{ precio?: number; nota?: string | null }>) {
  return (
    <>
      <CampoPesos
        name="precioEntrada"
        label="Precio de entrada"
        valorInicial={precio}
        size="md"
        required
      />
      <Textarea
        name="nota"
        label="Nota para el equipo"
        defaultValue={nota ?? ''}
        maxLength={280}
        autosize
        minRows={2}
        size="md"
      />
    </>
  );
}

/** Lo que muestra un día elegido: habilitarlo, o la noche con su dotación y sus acciones. */
function DetalleDia({
  fecha,
  noche,
  hoy,
  precioSugerido,
  alEditar,
}: Readonly<{
  fecha: string;
  noche: NocheDelCalendario | undefined;
  hoy: string;
  precioSugerido: number;
  alEditar: () => void;
}>) {
  if (!noche) {
    if (fecha < hoy) return <Text c="dimmed">No hubo noche este día.</Text>;
    return (
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Este día está cerrado. Al habilitarlo, el personal puede postular desde «Mis turnos».
        </Text>
        <FormularioAccion accion={programarNoche} textoEnviar="Habilitar este día">
          <input type="hidden" name="fecha" value={fecha} />
          <CamposNoche precio={precioSugerido} />
        </FormularioAccion>
      </Stack>
    );
  }

  const sinTurno = noche.postulantes.filter(
    (p) => !noche.turnos.some((t) => t.usuarioId === p.usuarioId),
  );
  return (
    <Stack gap="md">
      <div>
        <Text>Entrada {formatearPesos(noche.precioEntrada)}</Text>
        {noche.nota && <Text c="dimmed">{noche.nota}</Text>}
      </div>

      <div>
        <Title order={4} size="h5" mb={6}>
          {noche.estado === 'cerrada' ? 'Quién trabajó' : 'Con turno'} ({noche.turnos.length})
        </Title>
        {noche.turnos.length === 0 && (
          <Text size="sm" c="dimmed">
            Todavía nadie tiene turno.
          </Text>
        )}
        <Stack gap={6}>
          {noche.turnos.map((turno) => (
            <Group key={turno.usuarioId} justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Box
                  w={10}
                  h={10}
                  style={{
                    borderRadius: '50%',
                    background: `var(--mantine-color-${colorDelRol[turno.rol]}-5)`,
                  }}
                />
                <Text size="sm" fw={500}>
                  {turno.nombre}
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                {[nombreDelRol[turno.rol], turno.ambiente].filter(Boolean).join(' · ')}
              </Text>
            </Group>
          ))}
        </Stack>
      </div>

      {noche.estado !== 'cerrada' && (
        <div>
          <Title order={4} size="h5" mb={6}>
            Postulan sin turno ({sinTurno.length})
          </Title>
          <Text size="sm" c="dimmed">
            {sinTurno.length === 0
              ? 'Nadie más postuló.'
              : sinTurno.map((p) => p.nombre).join(', ')}
          </Text>
        </div>
      )}

      {noche.estado !== 'cerrada' && (
        <Group gap="xs">
          <Button
            component={Link}
            href={`/admin/asignacion?fecha=${fecha}`}
            size="sm"
            mih={44}
            leftSection={<IconUserCheck size={18} />}
          >
            Asignar turnos
          </Button>
          <Button
            size="sm"
            mih={44}
            variant="default"
            onClick={alEditar}
            aria-label={`Editar la noche del ${formatearFecha(fecha)}`}
          >
            Editar
          </Button>
          {noche.estado === 'programada' && (
            <BotonAccion
              accion={eliminarNoche}
              datos={{ fecha }}
              etiqueta="Deshabilitar"
              color="red"
              aria-label={`Deshabilitar la noche del ${formatearFecha(fecha)}`}
              confirmar={`¿Deshabilitar la noche del ${formatearFecha(fecha)}? Se pierden sus postulaciones y turnos.`}
            />
          )}
        </Group>
      )}
    </Stack>
  );
}

// HU-08: el calendario de noches como calendario. Cada día muestra su estado y su dotación; al
// tocarlo se habilita (el personal postula desde «Mis turnos») o se ve quién trabaja o trabajó.
export function CalendarioNoches({
  datos,
  diaInicial,
}: Readonly<{ datos: CalendarioDelMes; diaInicial: string | null }>) {
  const router = useRouter();
  const ancha = useMediaQuery('(min-width: 62em)');
  const [dia, setDia] = useState<string | null>(diaInicial);
  const [programando, setProgramando] = useState(false);
  const [fechaNueva, setFechaNueva] = useState('');
  const [editando, setEditando] = useState(false);

  const dias: Record<string, DiaDelCalendario> = Object.fromEntries(
    Object.entries(datos.noches).map(([fecha, noche]) => [
      fecha,
      {
        etiqueta: `${formatearFecha(fecha)}, noche ${estados[noche.estado].texto.toLowerCase()}, ${noche.turnos.length} con turno, ${noche.postulantes.length} postulan`,
        color: estados[noche.estado].color,
        contenido: <PersonasDelDia noche={noche} />,
      },
    ]),
  );
  const noche = dia ? datos.noches[dia] : undefined;

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconCalendarEvent}
        titulo="Calendario de noches"
        descripcion="Toca un día para habilitarlo o ver quién trabaja. La fecha operativa no cambia aunque la noche termine de madrugada."
      >
        <Button size="sm" mih={44} onClick={() => setProgramando(true)}>
          Programar noche
        </Button>
      </EncabezadoPagina>

      <Group gap="md">
        {Object.values(estados).map((estado) => (
          <Group key={estado.texto} gap={6} wrap="nowrap">
            <Box
              w={10}
              h={10}
              style={{ borderRadius: 3, background: `var(--mantine-color-${estado.color}-6)` }}
            />
            <Text size="xs" c="dimmed">
              {estado.texto}
            </Text>
          </Group>
        ))}
        {Object.entries(nombreDelRol).map(([rol, nombre]) => (
          <Group key={rol} gap={6} wrap="nowrap">
            <Box
              w={10}
              h={10}
              style={{
                borderRadius: '50%',
                background: `var(--mantine-color-${colorDelRol[rol]}-5)`,
              }}
            />
            <Text size="xs" c="dimmed">
              {nombre}
            </Text>
          </Group>
        ))}
      </Group>

      <Card withBorder padding="sm">
        <CalendarioMes
          mes={datos.mes}
          hoy={datos.hoy}
          rutaDelMes={(mes) => ruta(mes)}
          dias={dias}
          seleccionado={dia}
          alElegir={setDia}
        />
      </Card>

      <Drawer
        opened={dia !== null}
        onClose={() => setDia(null)}
        position={ancha ? 'right' : 'bottom'}
        size={ancha ? 420 : '85%'}
        radius="lg"
        zIndex={400}
        closeButtonProps={{ 'aria-label': 'Cerrar' }}
        styles={
          ancha ? undefined : { content: { height: 'auto', maxHeight: '85dvh', flex: '0 0 auto' } }
        }
        title={
          dia && (
            <Group gap="sm">
              <Text fw={700} size="lg">
                {tituloDeFecha(dia)}
              </Text>
              {noche && (
                <Badge color={estados[noche.estado].color}>{estados[noche.estado].texto}</Badge>
              )}
            </Group>
          )
        }
      >
        {dia && (
          <DetalleDia
            fecha={dia}
            noche={noche}
            hoy={datos.hoy}
            precioSugerido={datos.precioSugerido}
            alEditar={() => setEditando(true)}
          />
        )}
      </Drawer>

      <Modal opened={programando} onClose={() => setProgramando(false)} title="Programar noche">
        <FormularioAccion
          accion={programarNoche}
          textoEnviar="Guardar"
          alTerminar={() => {
            setProgramando(false);
            // Lleva el calendario al mes de la noche nueva, con su detalle abierto.
            if (fechaNueva) router.push(ruta(mesDe(fechaNueva), fechaNueva));
          }}
        >
          <TextInput
            name="fecha"
            label="Fecha operativa"
            type="date"
            size="md"
            required
            value={fechaNueva}
            onChange={(evento) => setFechaNueva(evento.currentTarget.value)}
          />
          <CamposNoche precio={datos.precioSugerido} />
        </FormularioAccion>
      </Modal>

      <Modal
        opened={editando && Boolean(noche)}
        onClose={() => setEditando(false)}
        title="Editar noche"
      >
        {dia && noche && (
          <FormularioAccion
            accion={editarNoche}
            textoEnviar="Guardar"
            alTerminar={() => setEditando(false)}
          >
            <input type="hidden" name="fecha" value={dia} />
            <Text fw={600}>{tituloDeFecha(dia)}</Text>
            <CamposNoche precio={noche.precioEntrada} nota={noche.nota} />
          </FormularioAccion>
        )}
      </Modal>
    </Stack>
  );
}
