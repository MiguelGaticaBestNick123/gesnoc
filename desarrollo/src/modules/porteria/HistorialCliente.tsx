'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { enviarJson } from '@/shared/red';
import { fechaCorta, formatearHora } from '@/shared/utilidades/fechas';
import { formatearDocumento, type TipoDocumento } from '@/shared/utilidades/rut';
import { formas } from './formas';
import { TIPOS_DE_REPORTE, tiposDeReporte, type TipoReporte } from './reportes';
import type { Historial } from './servicios/clientes';
import type { Busqueda } from './servicios/puerta';

type ResumenDeReportes = NonNullable<Busqueda['cliente']>['reportes'];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * HU-36 CA2: al buscar al cliente en la puerta aparecen sus reportes, sin un toque más: cuántos tiene
 * y el último. En rojo si alguna vez fue expulsado.
 */
export function AvisoReportes({ reportes }: Readonly<{ reportes: ResumenDeReportes }>) {
  const ultimo = reportes.ultimo;
  if (!ultimo) return null;
  return (
    <Alert
      color={reportes.expulsado ? 'red' : 'yellow'}
      variant="light"
      icon={<IconAlertTriangle size={20} />}
      title={`${plural(reportes.total, 'reporte', 'reportes')}${reportes.expulsado ? ' · fue expulsado' : ''}`}
      role="alert"
    >
      Último: {tiposDeReporte[ultimo.tipo].nombre.toLowerCase()} el {fechaCorta(ultimo.fecha)}, «
      {ultimo.descripcion}»
    </Alert>
  );
}

/** HU-35: el formulario del reporte. Autor, noche y hora los registra el servidor (RN-30). */
function NuevoReporte({
  tipoDocumento,
  documento,
  alGuardar,
}: Readonly<{ tipoDocumento: TipoDocumento; documento: string; alGuardar: () => Promise<void> }>) {
  const [tipo, setTipo] = useState<TipoReporte>('advertencia');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    const respuesta = await enviarJson('/api/clientes/reportes', {
      tipoDocumento,
      documento,
      tipo,
      descripcion,
    });
    setGuardando(false);
    if (!respuesta.ok) {
      setError(respuesta.error);
      return;
    }
    setDescripcion('');
    setGuardado(true);
    await alGuardar();
  }

  return (
    <Card withBorder padding="sm">
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar();
        }}
      >
        <Stack gap="xs">
          <Text fw={700}>Nuevo reporte</Text>
          <SegmentedControl
            fullWidth
            value={tipo}
            onChange={(valor) => setTipo(valor as TipoReporte)}
            aria-label="Tipo de reporte"
            data={TIPOS_DE_REPORTE.map((t) => ({ value: t, label: tiposDeReporte[t].nombre }))}
          />
          <Textarea
            label="Qué pasó"
            placeholder="Por ejemplo: comenzó a buscar pelea en la barra"
            autosize
            minRows={2}
            maxLength={1000}
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.currentTarget.value)}
          />
          <Text size="xs" c="dimmed">
            Un reporte no se edita ni se borra. Solo lo ven el guardia y la administración.
          </Text>
          {error && (
            <Alert color="red" variant="light" role="alert">
              {error}
            </Alert>
          )}
          {guardado && (
            <Text size="sm" c="green.4" role="status">
              Reporte guardado.
            </Text>
          )}
          <Button type="submit" mih={44} loading={guardando}>
            Guardar reporte
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

/** HU-36 CA1: las noches en que entró y sus reportes, del más reciente al más antiguo. */
function HistorialCliente({
  historial,
  tipoDocumento,
  alReportar,
}: Readonly<{
  historial: Historial;
  tipoDocumento: TipoDocumento;
  alReportar: () => Promise<void>;
}>) {
  const { cliente, visitas, reportes } = historial;
  if (!cliente) {
    return (
      <Text c="dimmed">
        {formatearDocumento(historial.documento)} no tiene registro: nunca pasó por la puerta.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      <div>
        <Title order={2} size="h3">
          {cliente.nombre} {cliente.apellido}
        </Title>
        <Text c="dimmed" size="sm">
          {formatearDocumento(historial.documento)} · {plural(visitas.length, 'visita', 'visitas')}{' '}
          · {plural(reportes.length, 'reporte', 'reportes')}
        </Text>
      </div>

      {historial.nocheAbierta ? (
        <NuevoReporte
          tipoDocumento={tipoDocumento}
          documento={historial.documento}
          alGuardar={alReportar}
        />
      ) : (
        <Text size="sm" c="dimmed">
          Los reportes se registran durante una noche abierta.
        </Text>
      )}

      <Stack gap="xs">
        <Title order={3} size="h5">
          Reportes
        </Title>
        {reportes.length === 0 && (
          <Text size="sm" c="dimmed">
            Sin reportes.
          </Text>
        )}
        {reportes.map((reporte) => {
          const tipo = tiposDeReporte[reporte.tipo];
          return (
            <Card
              key={reporte.numero}
              withBorder
              padding="sm"
              component="article"
              aria-label={`Reporte ${reporte.numero}: ${tipo.nombre}`}
              style={{ borderLeft: `3px solid var(--mantine-color-${tipo.color}-6)` }}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Badge color={tipo.color} variant="light">
                  {tipo.nombre}
                </Badge>
                <Text size="xs" c="dimmed">
                  {fechaCorta(reporte.fecha)} · {formatearHora(reporte.registradoEn)}
                </Text>
              </Group>
              <Text mt={4} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {reporte.descripcion}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Por {reporte.autor}
              </Text>
            </Card>
          );
        })}
      </Stack>

      <Stack gap={4}>
        <Title order={3} size="h5">
          Visitas
        </Title>
        {visitas.length === 0 && (
          <Text size="sm" c="dimmed">
            Sin visitas registradas.
          </Text>
        )}
        {visitas.map((visita) => (
          <Group key={visita.fecha} justify="space-between" wrap="nowrap">
            <Text size="sm">{fechaCorta(visita.fecha)}</Text>
            <Text size="sm" c="dimmed">
              {visita.ticket !== null && `Ticket ${visita.ticket} · `}
              {formas[visita.forma].codigo} · {formatearHora(visita.registradaEn)}
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * Carga el historial de un documento y lo vuelve a cargar después de un reporte. Va por POST para
 * que el RUT no quede en la dirección (RN-25).
 */
export function HistorialPorDocumento({
  tipoDocumento,
  documento,
}: Readonly<{ tipoDocumento: TipoDocumento; documento: string }>) {
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const respuesta = await enviarJson<Historial>('/api/clientes/historial', {
      tipoDocumento,
      documento,
    });
    if (respuesta.ok) {
      setHistorial(respuesta.datos);
      setError(null);
    } else setError(respuesta.error);
  }, [tipoDocumento, documento]);

  useEffect(() => {
    const primera = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(primera);
  }, [cargar]);

  if (error) {
    return (
      <Alert color="red" variant="light" role="alert">
        {error}
      </Alert>
    );
  }
  if (!historial) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" aria-label="Cargando el historial" />
      </Group>
    );
  }
  return (
    <HistorialCliente historial={historial} tipoDocumento={tipoDocumento} alReportar={cargar} />
  );
}
