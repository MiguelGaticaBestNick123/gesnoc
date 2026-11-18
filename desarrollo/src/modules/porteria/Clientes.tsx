'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconHistory, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { enviarJson } from '@/shared/red';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { fechaCorta } from '@/shared/utilidades/fechas';
import { formatearDocumento, type TipoDocumento } from '@/shared/utilidades/rut';
import { plural } from '@/shared/utilidades/texto';
import { HistorialPorDocumento } from './HistorialCliente';
import type { buscarClientes } from './servicios/clientes';

type Modo = TipoDocumento | 'nombre';
type Encontrado = Awaited<ReturnType<typeof buscarClientes>>[number];

/**
 * El tipo del documento de una ficha ya guardada, sin adivinarlo (RN-21): el RUT se guarda con guion
 * y el documento extranjero sin signos. Un pasaporte de solo números puede parecer un RUT válido, y
 * leerlo como RUT abriría la ficha de otra persona.
 */
const tipoDe = (documento: string): TipoDocumento =>
  documento.includes('-') ? 'rut' : 'extranjero';

/**
 * HU-35 y HU-36: buscar a un cliente por su documento o por su nombre para ver su historial o
 * reportarlo. La administración, además, puede corregir el nombre de la ficha.
 */
export function Clientes({ puedeCorregir = false }: Readonly<{ puedeCorregir?: boolean }>) {
  const [modo, setModo] = useState<Modo>('rut');
  const [texto, setTexto] = useState('');
  const [encontrados, setEncontrados] = useState<Encontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<{
    tipoDocumento: TipoDocumento;
    documento: string;
    vez: number;
  } | null>(null);

  const ver = (tipoDocumento: TipoDocumento, documento: string) =>
    setConsulta((anterior) => ({ tipoDocumento, documento, vez: (anterior?.vez ?? 0) + 1 }));

  async function buscar() {
    if (!texto.trim()) return;
    setError(null);
    if (modo !== 'nombre') {
      ver(modo, texto);
      return;
    }
    setBuscando(true);
    setConsulta(null);
    const respuesta = await enviarJson<Encontrado[]>('/api/clientes/buscar', { texto });
    setBuscando(false);
    if (respuesta.ok) setEncontrados(respuesta.datos);
    else setError(respuesta.error);
  }

  return (
    <Stack gap="md" maw={640}>
      <EncabezadoPagina
        icono={IconHistory}
        titulo="Clientes"
        descripcion="Visitas y reportes de cada cliente. Solo los ven el guardia y la administración."
      />
      <Card withBorder padding="md">
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void buscar();
          }}
        >
          <Stack gap="xs">
            <SegmentedControl
              value={modo}
              onChange={(valor) => {
                setModo(valor as Modo);
                setEncontrados(null);
                setError(null);
              }}
              aria-label="Buscar por"
              fullWidth
              data={[
                { value: 'rut', label: 'RUT' },
                { value: 'extranjero', label: 'Extranjero' },
                { value: 'nombre', label: 'Nombre' },
              ]}
            />
            <TextInput
              label={modo === 'nombre' ? 'Nombre o apellido' : 'Documento'}
              placeholder={
                modo === 'rut'
                  ? '12.345.678-5'
                  : modo === 'extranjero'
                    ? 'Letras y números'
                    : 'Por ejemplo: Mora'
              }
              value={texto}
              onChange={(evento) => setTexto(evento.currentTarget.value)}
              autoComplete="off"
              size="md"
            />
            <Button
              type="submit"
              mih={44}
              loading={buscando}
              leftSection={<IconSearch size={18} />}
            >
              Buscar
            </Button>
          </Stack>
        </form>
      </Card>

      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}

      {modo === 'nombre' && encontrados && !consulta && (
        <Stack gap="xs" aria-label="Clientes encontrados">
          {encontrados.length === 0 && <Text c="dimmed">Nadie con ese nombre.</Text>}
          {encontrados.map((cliente) => (
            <UnstyledButton
              key={cliente.documento}
              onClick={() => ver(tipoDe(cliente.documento), cliente.documento)}
              aria-label={`Ver el historial de ${cliente.nombre} ${cliente.apellido}`}
            >
              <Card withBorder padding="sm">
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} truncate>
                      {cliente.nombre} {cliente.apellido}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatearDocumento(cliente.documento)} ·{' '}
                      {plural(cliente.visitas, 'visita', 'visitas')}
                      {cliente.ultimaVisita && ` · última ${fechaCorta(cliente.ultimaVisita)}`}
                      {cliente.expulsado && ' · fue expulsado'}
                    </Text>
                  </div>
                  {cliente.reportes > 0 && (
                    <Badge
                      color={cliente.expulsado ? 'red' : 'yellow'}
                      variant="light"
                      style={{ flexShrink: 0 }}
                    >
                      {plural(cliente.reportes, 'reporte', 'reportes')}
                    </Badge>
                  )}
                </Group>
              </Card>
            </UnstyledButton>
          ))}
        </Stack>
      )}

      {consulta && (
        <Card withBorder padding="md">
          {modo === 'nombre' && (
            <Button variant="subtle" size="sm" mih={44} mb="xs" onClick={() => setConsulta(null)}>
              Volver a los resultados
            </Button>
          )}
          <HistorialPorDocumento
            key={consulta.vez}
            tipoDocumento={consulta.tipoDocumento}
            documento={consulta.documento}
            puedeCorregir={puedeCorregir}
          />
        </Card>
      )}
    </Stack>
  );
}
