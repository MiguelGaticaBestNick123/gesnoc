'use client';

import { Badge, Card, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { paraBuscar } from '@/shared/utilidades/buscar';
import { formatearHora } from '@/shared/utilidades/fechas';
import { formatearDocumento } from '@/shared/utilidades/rut';
import { formas } from './formas';
import type { IngresosDeLaNoche } from './servicios/puerta';
import { plural } from '@/shared/utilidades/texto';

type Ingreso = IngresosDeLaNoche['ingresos'][number];

/** Un ingreso como lo anota la puerta: hora, ticket, nombre, RUT y forma (EF, RC, PN o gratis). */
function FilaIngreso({ ingreso }: Readonly<{ ingreso: Ingreso }>) {
  const forma = formas[ingreso.forma];
  const nombre = `${ingreso.nombre} ${ingreso.apellido}`;
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="sm"
      py={8}
      role="listitem"
      aria-label={`${nombre}, ${forma.codigo}${ingreso.ticket ? `, ticket ${ingreso.ticket}` : ''}, ${formatearHora(ingreso.registradaEn)}`}
      style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}
    >
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <Stack gap={0} align="center" w={52} style={{ flexShrink: 0 }}>
          <Text size="xs" c="dimmed" lh={1.2}>
            {formatearHora(ingreso.registradaEn)}
          </Text>
          <Text fw={800} size="lg" lh={1.2} c={ingreso.ticket ? undefined : 'dimmed'}>
            {ingreso.ticket ?? '—'}
          </Text>
        </Stack>
        <div style={{ minWidth: 0 }}>
          <Text fw={600} truncate>
            {nombre}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {formatearDocumento(ingreso.documento)}
          </Text>
        </div>
      </Group>
      <Badge color={forma.color} variant="light" size="lg" miw={64} tt="none">
        {forma.codigo}
      </Badge>
    </Group>
  );
}

/**
 * HU-32 como la pidió el Product Owner: quiénes entraron, sin montos. El guardia busca por nombre o
 * RUT, por ejemplo cuando alguien dice que ya pagó.
 */
export function ListaDeIngresos({
  ingresos,
  limite,
}: Readonly<{ ingresos: Ingreso[]; limite?: number }>) {
  const [busqueda, setBusqueda] = useState('');
  const texto = paraBuscar(busqueda.trim()).replace(/[.\-\s]/g, '');
  const visibles = ingresos.filter(
    (ingreso) =>
      !texto ||
      paraBuscar(`${ingreso.nombre}${ingreso.apellido}`).replace(/\s/g, '').includes(texto) ||
      paraBuscar(ingreso.documento).replace('-', '').includes(texto),
  );
  const mostrados = limite ? visibles.slice(0, limite) : visibles;

  return (
    <Stack gap="xs">
      {!limite && (
        <TextInput
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.currentTarget.value)}
          placeholder="Buscar por nombre o RUT"
          aria-label="Buscar entre los ingresos"
          leftSection={<IconSearch size={18} />}
          size="md"
        />
      )}
      {ingresos.length === 0 && <Text c="dimmed">Todavía no entra nadie esta noche.</Text>}
      {ingresos.length > 0 && mostrados.length === 0 && (
        <Text c="dimmed">Nadie coincide con la búsqueda.</Text>
      )}
      <div role="list" aria-label="Ingresos de esta noche">
        {mostrados.map((ingreso) => (
          <FilaIngreso key={`${ingreso.documento}`} ingreso={ingreso} />
        ))}
      </div>
    </Stack>
  );
}

export function TarjetaIngresos({
  datos,
  children,
}: Readonly<{ datos: IngresosDeLaNoche; children: React.ReactNode }>) {
  const personas = datos.ingresos.length;
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="xs" gap="xs">
        <Text fw={700} size="lg">
          Ingresos de esta noche
        </Text>
        <Group gap="xs">
          <Badge
            variant="light"
            size="lg"
            tt="none"
            aria-label={plural(personas, 'persona', 'personas')}
          >
            {personas} {personas === 1 ? 'persona' : 'personas'}
          </Badge>
          {datos.ultimoTicket !== null && (
            <Badge variant="light" color="gray" size="lg" tt="none">
              Último ticket {datos.ultimoTicket}
            </Badge>
          )}
        </Group>
      </Group>
      {children}
    </Card>
  );
}
