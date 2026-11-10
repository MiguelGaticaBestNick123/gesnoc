'use client';

import {
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useElementSize } from '@mantine/hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { formatearHora } from '@/shared/utilidades/fechas';
import { NuevaCuentaDePie } from './NuevaCuentaDePie';
import { escalaDelPlano } from './plano';
import type { Mapa } from './servicios/cuentas';

type Mesa = Mapa['mesas'][number];

const rutaDeCuenta = (numero: number) => `/garzon/cuenta/${numero}`;
// HU-13: el mapa del ambiente con cada mesa libre u ocupada, al día cada pocos segundos.
export function MapaMesas({ inicial }: Readonly<{ inicial: Mapa }>) {
  const router = useRouter();
  const [ambienteId, setAmbienteId] = useState(inicial.ambiente.id);
  const { datos, sinConexion } = useTiempoReal(`/api/vivo/mesas?ambiente=${ambienteId}`, inicial);
  const [mesaId, setMesaId] = useState<number | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dePieAbierto, dePie] = useDisclosure(false);
  const { ref: refPlano, width: anchoDisponible } = useElementSize();

  const { ambiente, mesas } = datos;
  const escala = escalaDelPlano(anchoDisponible, ambiente.planoAncho, mesas);
  const seleccionada = mesas.find((mesa) => mesa.id === mesaId);
  const ocupadas = mesas.filter((mesa) => mesa.cuenta !== null).length;

  const elegir = (id: number | null) => {
    setMesaId(id);
    setError(null);
  };

  async function abrirCuenta(mesa: Mesa) {
    setAbriendo(true);
    setError(null);
    const respuesta = await enviarJson<{ numero: number }>('/api/cuentas', { mesaId: mesa.id });
    setAbriendo(false);
    if (respuesta.ok) router.push(rutaDeCuenta(respuesta.datos.numero));
    else setError(respuesta.error);
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Mesas</Title>
          <Text c="dimmed" size="sm">
            {ambiente.nombre}: {ocupadas} ocupadas · {mesas.length - ocupadas} libres ·{' '}
            {datos.dePie.length} de pie
          </Text>
        </div>
        <Button size="sm" mih={44} variant="light" onClick={dePie.open} disabled={!datos.noche}>
          Cliente de pie
        </Button>
      </Group>

      {datos.ambientes.length > 1 && (
        <SegmentedControl
          value={String(ambienteId)}
          onChange={(valor) => {
            setAmbienteId(Number(valor));
            elegir(null);
          }}
          data={datos.ambientes.map((a) => ({ value: String(a.id), label: a.nombre }))}
        />
      )}

      <AvisoConexion sinConexion={sinConexion} />
      {!datos.noche && (
        <Alert color="yellow" variant="light">
          No hay una noche abierta: no se pueden abrir cuentas.{' '}
          <Anchor component={Link} href="/admin/noche">
            Ir a la noche en curso
          </Anchor>
        </Alert>
      )}

      <Card withBorder padding="sm">
        <Box ref={refPlano} w="100%">
          <ScrollArea type="auto" offsetScrollbars>
            <Box w={ambiente.planoAncho * escala} h={ambiente.planoAlto * escala}>
              <Box
                pos="relative"
                w={ambiente.planoAncho}
                h={ambiente.planoAlto}
                style={{
                  transform: `scale(${escala})`,
                  transformOrigin: 'top left',
                  backgroundImage:
                    'linear-gradient(var(--mantine-color-dark-5) 1px, transparent 1px), linear-gradient(90deg, var(--mantine-color-dark-5) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                  borderRadius: 'var(--mantine-radius-md)',
                }}
              >
                {mesas.map((mesa) => {
                  const ocupada = mesa.cuenta !== null;
                  return (
                    <UnstyledButton
                      key={mesa.id}
                      onClick={() => elegir(mesa.id)}
                      aria-label={`Mesa ${mesa.numero}, ${ocupada ? 'ocupada' : 'libre'}`}
                      style={{
                        position: 'absolute',
                        left: mesa.posX,
                        top: mesa.posY,
                        width: mesa.ancho,
                        height: mesa.alto,
                        transform: `rotate(${mesa.rotacion}deg)`,
                        borderRadius: mesa.forma === 'redonda' ? '50%' : 'var(--mantine-radius-md)',
                        background: ocupada
                          ? 'var(--mantine-color-violet-8)'
                          : 'var(--mantine-color-dark-6)',
                        border: `3px solid ${
                          mesa.id === mesaId
                            ? 'var(--mantine-color-violet-2)'
                            : ocupada
                              ? 'var(--mantine-color-violet-5)'
                              : 'var(--mantine-color-dark-3)'
                        }`,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Text fw={700} fz={32} lh={1}>
                        {mesa.numero}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Box>
            </Box>
          </ScrollArea>
        </Box>
      </Card>

      {datos.dePie.length > 0 && (
        <Stack gap="xs">
          <Title order={3} size="h5">
            Clientes de pie
          </Title>
          {datos.dePie.map((cuenta) => (
            <Button
              key={cuenta.numero}
              component={Link}
              href={rutaDeCuenta(cuenta.numero)}
              variant="default"
              justify="space-between"
              rightSection={formatearHora(cuenta.abiertaEn)}
            >
              Cuenta {cuenta.numero}: {cuenta.referencia}
            </Button>
          ))}
        </Stack>
      )}

      <Drawer
        opened={seleccionada !== undefined}
        onClose={() => elegir(null)}
        position="bottom"
        size={300}
        title={seleccionada && `Mesa ${seleccionada.numero}`}
      >
        {seleccionada && (
          <Stack gap="sm">
            {error && (
              <Alert color="red" variant="light" role="alert">
                {error}
              </Alert>
            )}
            {seleccionada.cuenta === null ? (
              <>
                <Text c="dimmed">Libre</Text>
                <Button
                  onClick={() => abrirCuenta(seleccionada)}
                  loading={abriendo}
                  disabled={!datos.noche}
                >
                  Abrir cuenta
                </Button>
              </>
            ) : (
              <>
                <Text>
                  Cuenta {seleccionada.cuenta} · desde{' '}
                  {seleccionada.abiertaEn && formatearHora(seleccionada.abiertaEn)} ·{' '}
                  {seleccionada.garzon}
                </Text>
                <Button component={Link} href={rutaDeCuenta(seleccionada.cuenta)}>
                  Ver cuenta
                </Button>
              </>
            )}
          </Stack>
        )}
      </Drawer>

      <NuevaCuentaDePie ambienteId={ambiente.id} abierto={dePieAbierto} alCerrar={dePie.close} />
    </Stack>
  );
}
