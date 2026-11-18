'use client';

import { Badge, Button, Card, Group, NativeSelect, Stack, Text } from '@mantine/core';
import { IconTimelineEvent } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { formatearHora, tituloDeFecha } from '@/shared/utilidades/fechas';
import { categorias, type Categoria } from './bitacora';
import type { Bitacora } from './servicios/bitacora';

const POR_PAGINA = 150;

const colorDe: Record<Categoria, string> = {
  noche: 'gray',
  pedidos: 'violeta',
  cobros: 'green',
  puerta: 'yellow',
  llamados: 'orange',
};

/**
 * Bitácora de la noche: cada evento con su hora y quién lo hizo, del más reciente al más antiguo.
 * Se filtra por tipo y por persona; responde «¿quién anuló ese trago?» o «¿quién cerró esa cuenta?».
 */
export function BitacoraNoche({ datos }: Readonly<{ datos: Bitacora }>) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Categoria | 'todo'>('todo');
  const [persona, setPersona] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const { elegida, eventos } = datos;

  const personas = useMemo(
    () =>
      [...new Set(eventos.flatMap((e) => (e.actor ? [e.actor] : [])))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [eventos],
  );
  const visibles = eventos.filter(
    (e) => (filtro === 'todo' || e.categoria === filtro) && (!persona || e.actor === persona),
  );

  return (
    <Stack gap="md" maw={820}>
      <EncabezadoPagina
        icono={IconTimelineEvent}
        titulo="Bitácora"
        descripcion="Quién hizo qué y cuándo en la noche: cada evento con su autor y su hora."
      />
      {!elegida ? (
        <EstadoVacio
          texto="Todavía no hay noches abiertas."
          accion="Ir a la noche en curso"
          href="/admin/noche"
        />
      ) : (
        <>
          <Group gap="sm" align="flex-end">
            <NativeSelect
              label="Noche"
              value={elegida.fecha}
              onChange={(evento) =>
                router.push(`/admin/bitacora?fecha=${evento.currentTarget.value}`)
              }
              size="md"
              miw={240}
              data={datos.noches.map((noche) => ({
                value: noche.fecha,
                label: `${tituloDeFecha(noche.fecha)}${noche.cerrada ? '' : ' (abierta)'}`,
              }))}
            />
            <NativeSelect
              label="Persona"
              value={persona}
              onChange={(evento) => setPersona(evento.currentTarget.value)}
              size="md"
              miw={200}
              data={[
                { value: '', label: 'Todas' },
                ...personas.map((p) => ({ value: p, label: p })),
              ]}
            />
          </Group>
          <Group gap="xs" component="nav" aria-label="Tipo de evento">
            {(['todo', ...Object.keys(categorias)] as (Categoria | 'todo')[]).map((clave) => (
              <Button
                key={clave}
                size="sm"
                mih={44}
                radius="xl"
                variant={filtro === clave ? 'filled' : 'default'}
                aria-pressed={filtro === clave}
                onClick={() => {
                  setFiltro(clave);
                  setMostrar(POR_PAGINA);
                }}
              >
                {clave === 'todo' ? 'Todo' : categorias[clave]}
              </Button>
            ))}
          </Group>
          <Text size="sm" c="dimmed">
            {visibles.length} {visibles.length === 1 ? 'evento' : 'eventos'}
          </Text>
          {visibles.length === 0 ? (
            <Text c="dimmed">No hay eventos con ese filtro.</Text>
          ) : (
            <Card withBorder padding={0}>
              <Stack gap={0} component="ol" m={0} p={0} style={{ listStyle: 'none' }}>
                {visibles.slice(0, mostrar).map((evento, i) => (
                  <Group
                    key={`${evento.marca}-${i}`}
                    component="li"
                    gap="sm"
                    wrap="nowrap"
                    align="flex-start"
                    px="md"
                    py="xs"
                    style={{
                      borderTop:
                        i === 0 ? undefined : '1px solid var(--mantine-color-default-border)',
                    }}
                  >
                    <Text
                      size="sm"
                      fw={700}
                      w={48}
                      style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatearHora(evento.marca)}
                    </Text>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                        {evento.texto}
                      </Text>
                      {evento.actor && (
                        <Text size="xs" c="dimmed">
                          {evento.actor}
                        </Text>
                      )}
                    </div>
                    <Badge
                      color={colorDe[evento.categoria]}
                      variant="light"
                      style={{ flexShrink: 0 }}
                      visibleFrom="xs"
                    >
                      {categorias[evento.categoria]}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            </Card>
          )}
          {visibles.length > mostrar && (
            <Button variant="default" mih={44} onClick={() => setMostrar((n) => n + POR_PAGINA)}>
              Ver {Math.min(POR_PAGINA, visibles.length - mostrar)} eventos más
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}
