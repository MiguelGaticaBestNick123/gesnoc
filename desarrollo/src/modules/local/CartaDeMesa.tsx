'use client';

import { Box, Button, Container, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { IconBell, IconBellRinging } from '@tabler/icons-react';
import { useState } from 'react';
import { enviarJson } from '@/shared/red';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { ordenarProductos, type OrdenCarta } from './carta';
import type { CartaPublica } from './servicios/carta';

type Llamado = 'libre' | 'enviando' | 'avisado';

const ordenes: { label: string; value: OrdenCarta }[] = [
  { label: 'Nombre', value: 'nombre' },
  { label: 'Menor precio', value: 'menor' },
  { label: 'Mayor precio', value: 'mayor' },
];

/**
 * HU-38 y HU-39: la carta que abre el cliente con el QR de su mesa, sin instalar nada ni crear una
 * cuenta. Es la única pantalla para alguien de fuera: texto grande, precios alineados a la derecha y
 * el botón para llamar al garzón siempre a mano, abajo, al alcance del pulgar.
 */
export function CartaDeMesa({ codigo, carta }: Readonly<{ codigo: string; carta: CartaPublica }>) {
  const [orden, setOrden] = useState<OrdenCarta>('nombre');
  const [categoria, setCategoria] = useState<number | null>(null);
  const [llamado, setLlamado] = useState<Llamado>(carta.llamadoPendiente ? 'avisado' : 'libre');
  const [error, setError] = useState<string | null>(null);

  const visibles =
    categoria === null ? carta.categorias : carta.categorias.filter((c) => c.id === categoria);

  async function llamar() {
    setLlamado('enviando');
    setError(null);
    const respuesta = await enviarJson<{ avisado: true }>(`/api/carta/${codigo}/llamado`, {});
    if (respuesta.ok) setLlamado('avisado');
    else {
      setLlamado('libre');
      setError(respuesta.error);
    }
  }

  return (
    <>
      <Container size="sm" px="md" pt="lg" pb={170}>
        <Stack gap="md">
          <div>
            <Title order={1}>Carta</Title>
            <Text c="dimmed" size="lg">
              Mesa {carta.mesa} · {carta.ambiente}
            </Text>
          </div>

          {carta.categorias.length === 0 ? (
            <Text>La carta todavía no tiene productos.</Text>
          ) : (
            <>
              {/* En un teléfono angosto las categorías se desplazan de lado, sin cortarse. */}
              <Box component="nav" aria-label="Categorías" style={{ overflowX: 'auto' }}>
                <Group gap="xs" wrap="nowrap" pb={4}>
                  {[{ id: null, nombre: 'Todo' }, ...carta.categorias].map(({ id, nombre }) => (
                    <Button
                      key={id ?? 'todo'}
                      radius="xl"
                      mih={44}
                      variant={categoria === id ? 'filled' : 'default'}
                      aria-pressed={categoria === id}
                      onClick={() => setCategoria(id)}
                      style={{ flexShrink: 0 }}
                    >
                      {nombre}
                    </Button>
                  ))}
                </Group>
              </Box>

              <SegmentedControl
                fullWidth
                value={orden}
                onChange={(valor) => setOrden(valor as OrdenCarta)}
                data={ordenes}
                aria-label="Ordenar los productos"
              />

              {visibles.map((grupo) => (
                <section key={grupo.id} aria-labelledby={`categoria-${grupo.id}`}>
                  <Title order={2} size="h3" id={`categoria-${grupo.id}`} mt="xs">
                    {grupo.nombre}
                  </Title>
                  <Box component="ul" m={0} p={0} style={{ listStyle: 'none' }}>
                    {ordenarProductos(grupo.productos, orden).map((producto) => (
                      <Group
                        component="li"
                        key={producto.id}
                        justify="space-between"
                        wrap="nowrap"
                        gap="md"
                        py="sm"
                        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
                      >
                        <Text size="lg" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          {producto.nombre}
                        </Text>
                        <Text
                          size="lg"
                          fw={700}
                          style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatearPesos(producto.precio)}
                        </Text>
                      </Group>
                    ))}
                  </Box>
                </section>
              ))}
            </>
          )}
        </Stack>
      </Container>

      <Box
        pos="fixed"
        bottom={0}
        left={0}
        right={0}
        px="md"
        pt="sm"
        style={{
          zIndex: 10,
          background: 'var(--mantine-color-body)',
          borderTop: '1px solid var(--mantine-color-default-border)',
          paddingBottom: 'calc(var(--mantine-spacing-sm) + env(safe-area-inset-bottom))',
        }}
      >
        <Container size="sm" px={0}>
          <Stack gap="xs">
            {/* Mensaje de estado (WCAG 4.1.3): el lector de pantalla lo anuncia sin mover el foco. */}
            <div role="status">
              {!carta.atendiendo && (
                <Text c="dimmed" ta="center">
                  El local no está atendiendo en este momento.
                </Text>
              )}
              {carta.atendiendo && llamado === 'avisado' && (
                <Text ta="center" fw={600}>
                  Avisamos al garzón: ya viene a tu mesa.
                </Text>
              )}
              {error && (
                <Text c="red.4" ta="center">
                  {error}
                </Text>
              )}
            </div>
            <Button
              size="lg"
              mih={52}
              fullWidth
              disabled={!carta.atendiendo}
              loading={llamado === 'enviando'}
              variant={llamado === 'avisado' ? 'light' : 'filled'}
              leftSection={
                llamado === 'avisado' ? <IconBellRinging size={22} /> : <IconBell size={22} />
              }
              onClick={() => void llamar()}
            >
              {llamado === 'avisado' ? 'Volver a llamar' : 'Llamar al garzón'}
            </Button>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
