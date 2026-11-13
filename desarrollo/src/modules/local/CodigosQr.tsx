'use client';

import { Anchor, Box, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconDownload, IconPrinter, IconQrcode } from '@tabler/icons-react';
import Link from 'next/link';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { regenerarCodigoQr } from './acciones';
import type { CodigosDeMesas } from './servicios/qr';

/** HU-07: el código QR de cada mesa del ambiente, para abrir la carta, descargarlo o regenerarlo. */
export function CodigosQr({ datos }: Readonly<{ datos: CodigosDeMesas }>) {
  const { ambientes, ambiente, mesas } = datos;

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconQrcode}
        titulo="Códigos QR"
        descripcion="Cada mesa abre su carta y llama a los garzones de su ambiente."
      >
        {ambiente && mesas.length > 0 && (
          <Button
            component={Link}
            href={`/imprimir/qr?ambiente=${ambiente.id}`}
            variant="default"
            mih={44}
            leftSection={<IconPrinter size={18} />}
          >
            Imprimir
          </Button>
        )}
      </EncabezadoPagina>

      {ambientes.length > 1 && (
        <Group gap="xs" component="nav" aria-label="Ambientes">
          {ambientes.map((a) => (
            <Button
              key={a.id}
              component={Link}
              href={`/admin/qr?ambiente=${a.id}`}
              radius="xl"
              mih={44}
              variant={a.id === ambiente?.id ? 'filled' : 'default'}
              aria-current={a.id === ambiente?.id ? 'page' : undefined}
            >
              {a.nombre}
            </Button>
          ))}
        </Group>
      )}

      {mesas.length === 0 ? (
        <EstadoVacio
          texto={
            ambiente ? 'Este ambiente no tiene mesas.' : 'Primero crea un ambiente y sus mesas.'
          }
          accion="Ir al mapa de mesas"
          href="/admin/mapa"
        />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
          {mesas.map((mesa) => (
            <Card
              key={mesa.id}
              withBorder
              padding="md"
              component="article"
              aria-label={`Mesa ${mesa.numero}`}
            >
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="lg">
                  Mesa {mesa.numero}
                </Text>
                <Anchor
                  href={mesa.enlace}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Abrir la carta de la mesa ${mesa.numero}`}
                >
                  Abrir carta
                </Anchor>
              </Group>
              {/* El QR va siempre negro sobre blanco: con el tema oscuro, invertido, no se lee. */}
              <Box
                mx="auto"
                w={176}
                h={176}
                p={8}
                bg="white"
                role="img"
                aria-label={`Código QR de la mesa ${mesa.numero}`}
                style={{ borderRadius: 8 }}
                dangerouslySetInnerHTML={{ __html: mesa.svg }}
              />
              <Group grow mt="md" gap="xs" align="flex-start">
                <Button
                  component="a"
                  href={`/api/qr/${mesa.id}`}
                  download
                  variant="default"
                  size="sm"
                  mih={44}
                  leftSection={<IconDownload size={16} />}
                >
                  Descargar
                </Button>
                <BotonAccion
                  accion={regenerarCodigoQr}
                  datos={{ id: mesa.id }}
                  etiqueta="Regenerar"
                  color="orange"
                  fullWidth
                  confirmar={`El código impreso de la mesa ${mesa.numero} dejará de abrir la carta. ¿Generar uno nuevo?`}
                />
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
