'use client';

import {
  Box,
  Card,
  Divider,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Button,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArmchair,
  IconCash,
  IconChefHat,
  IconClipboardList,
  IconDoorEnter,
  IconLayoutDashboard,
  IconReceipt2,
  IconStar,
  IconWallet,
} from '@tabler/icons-react';
import Link from 'next/link';
import { FORMAS_DE_ENTRADA, formaDe } from '@/modules/porteria/formas';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { Cifra } from '@/shared/ui/Cifra';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { fechaCorta, formatearHora } from '@/shared/utilidades/fechas';
import { nombreDelMedio } from './cobro';
import { iconoDelMedio } from './iconos';
import type { ResumenDeLaNoche } from './servicios/resumen';
import { plural } from '@/shared/utilidades/texto';
import { SinNocheAbierta } from '@/shared/ui/SinNocheAbierta';
import { TituloTarjeta } from '@/shared/ui/TituloTarjeta';
import { FilasDeEntradas } from '@/modules/porteria/FilasDeEntradas';

// Portada de la administración: la noche en cifras reales, al día cada pocos segundos.
export function ResumenNoche({ inicial }: Readonly<{ inicial: ResumenDeLaNoche }>) {
  const { datos, sinConexion } = useTiempoReal('/api/vivo/resumen', inicial);
  const { noche, cifras, cobros, puerta, ambientes, ultimos, masPedidos } = datos;

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconLayoutDashboard}
        titulo="Resumen de la noche"
        descripcion={
          noche ? `Noche abierta · ${fechaCorta(noche)} · se actualiza solo` : 'Sin noche abierta'
        }
      />
      <AvisoConexion sinConexion={sinConexion} />

      {!noche || !cifras ? (
        <SinNocheAbierta detalle="Las cifras aparecen al abrirla." />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
          <Cifra
            icono={IconCash}
            color="violeta"
            etiqueta="Vendido"
            valor={formatearPesos(cifras.vendido)}
            detalle="Pedidos de la noche, sin anulados"
          />
          <Cifra
            icono={IconWallet}
            color="green"
            etiqueta="Cobrado"
            valor={formatearPesos(cifras.cobrado)}
            detalle="Pagos registrados, sin propinas"
          />
          <Cifra
            icono={IconReceipt2}
            color="yellow"
            etiqueta="Por cobrar"
            valor={formatearPesos(cifras.porCobrar)}
            detalle={`Saldo de ${plural(cifras.cuentasAbiertas, 'cuenta abierta', 'cuentas abiertas')}${cifras.cerradoConSaldo > 0 ? ` · ${formatearPesos(cifras.cerradoConSaldo)} cerrado con saldo` : ''}`}
          />
          <Cifra
            icono={IconChefHat}
            color="blue"
            etiqueta="En preparación"
            valor={String(cifras.enPreparacion)}
            detalle="Comandas en barra y cocina"
          />
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, md: 2, lg: cobros ? 3 : 2 }} spacing="md">
        <Card withBorder padding="md">
          <TituloTarjeta icono={IconArmchair}>Mesas en tiempo real</TituloTarjeta>
          <Stack gap="md">
            {ambientes.map((ambiente) => {
              const libres = ambiente.mesas - ambiente.ocupadas;
              const porcentaje = ambiente.mesas ? (ambiente.ocupadas / ambiente.mesas) * 100 : 0;
              return (
                <div key={ambiente.id}>
                  <Group justify="space-between" mb={6}>
                    <Text fw={600}>{ambiente.nombre}</Text>
                    <Text size="sm" fw={600}>
                      {formatearPesos(ambiente.vendido)}
                    </Text>
                  </Group>
                  <Progress value={porcentaje} color="violeta" size="md" radius="xl" />
                  <Group gap="md" mt={6}>
                    <Punto color="var(--mantine-color-violeta-4)">
                      {plural(ambiente.ocupadas, 'ocupada', 'ocupadas')}
                    </Punto>
                    <Punto color="var(--mantine-color-dark-3)">
                      {plural(libres, 'libre', 'libres')}
                    </Punto>
                  </Group>
                </div>
              );
            })}
          </Stack>
        </Card>

        {cobros && <Cobros cobros={cobros} />}

        <Card withBorder padding="md">
          <TituloTarjeta icono={IconStar}>Lo más pedido</TituloTarjeta>
          {masPedidos.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay pedidos esta noche.
            </Text>
          ) : (
            <Stack gap="xs">
              {masPedidos.map((producto, i) => (
                <Group key={producto.producto} justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text fw={700} c="violeta.3" w={18}>
                      {i + 1}
                    </Text>
                    <Text truncate>{producto.producto}</Text>
                  </Group>
                  <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {producto.unidades} u · {formatearPesos(producto.monto)}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: puerta ? 2 : 1 }} spacing="md">
        {puerta && <Puerta entradas={puerta} />}
        <Card withBorder padding="md">
          <TituloTarjeta icono={IconClipboardList}>Últimos pedidos</TituloTarjeta>
          {ultimos.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay pedidos esta noche.
            </Text>
          ) : (
            <Stack gap="xs">
              {ultimos.map((pedido) => (
                <Group key={pedido.numero} justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      Pedido {pedido.numero} · {pedido.ubicacion} · {pedido.ambiente}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {pedido.resumen} · {pedido.garzon}
                    </Text>
                  </div>
                  <Text size="sm" c="dimmed">
                    {formatearHora(pedido.enviadoEn)}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

/**
 * La puerta en la portada: cuántas personas entraron y cuánto dejó cada forma de entrada. Solo la
 * administración ve los montos; el guardia ve quién entró, sin lo recaudado.
 */
function Puerta({ entradas }: Readonly<{ entradas: NonNullable<ResumenDeLaNoche['puerta']> }>) {
  const de = (forma: (typeof FORMAS_DE_ENTRADA)[number]) =>
    entradas.find((e) => formaDe(e.medio) === forma);
  const personas = entradas.reduce((suma, e) => suma + e.personas, 0);
  const recaudado = (de('efectivo')?.monto ?? 0) + (de('tarjeta')?.monto ?? 0);
  return (
    <Card withBorder padding="md">
      <TituloTarjeta icono={IconDoorEnter}>Puerta</TituloTarjeta>
      <Group justify="space-between" align="flex-end" mb="sm" wrap="nowrap">
        <div>
          <Text fz={28} fw={800} lh={1}>
            {personas}
          </Text>
          <Text size="xs" c="dimmed">
            {personas === 1 ? 'persona entró' : 'personas entraron'}
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text fw={700}>{formatearPesos(recaudado)}</Text>
          <Text size="xs" c="dimmed">
            recaudado (EF y RC)
          </Text>
        </div>
      </Group>
      <FilasDeEntradas entradas={entradas} />
      {(de('pendiente')?.personas ?? 0) > 0 && (
        <Text size="xs" c="dimmed" mt="xs">
          Las entradas PN se pagan después a la administración: el detalle está en «Ventas y
          propinas».
        </Text>
      )}
      <Button
        component={Link}
        href="/guardia/puerta"
        size="sm"
        mih={44}
        mt="xs"
        px={0}
        variant="subtle"
      >
        Ver quién entró
      </Button>
    </Card>
  );
}

/**
 * HU-24: lo cobrado por medio de pago, de mayor a menor y en un solo color, porque se comparan los
 * montos y cada fila ya dice su nombre. Abajo, las propinas y el efectivo que falta entregar.
 */
function Cobros({ cobros }: Readonly<{ cobros: NonNullable<ResumenDeLaNoche['cobros']> }>) {
  const total = cobros.porMedio.reduce((suma, medio) => suma + medio.monto, 0);
  const ordenados = cobros.porMedio.toSorted((a, b) => b.monto - a.monto);
  const { porConfirmar } = cobros;

  return (
    <Card withBorder padding="md">
      <TituloTarjeta icono={IconWallet}>Cobros por medio de pago</TituloTarjeta>
      {total === 0 ? (
        <Text size="sm" c="dimmed">
          Todavía no hay cobros esta noche.
        </Text>
      ) : (
        <Stack gap="sm">
          {ordenados.map(({ medio, monto, pagos }) => {
            const Icono = iconoDelMedio[medio];
            const parte = monto / total;
            const porcentaje = `${Math.round(parte * 100)} %`;
            return (
              <div
                key={medio}
                role="group"
                aria-label={`${nombreDelMedio(medio)}: ${formatearPesos(monto)}, ${porcentaje}`}
              >
                <Group justify="space-between" wrap="nowrap" mb={6} gap="xs">
                  <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Icono size={18} stroke={1.7} color="var(--mantine-color-dimmed)" />
                    <Text fw={600} truncate>
                      {nombreDelMedio(medio)}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {pagos} {pagos === 1 ? 'pago' : 'pagos'}
                    </Text>
                  </Group>
                  <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                    {formatearPesos(monto)}{' '}
                    <Text span size="xs" c="dimmed">
                      · {porcentaje}
                    </Text>
                  </Text>
                </Group>
                <Barra parte={parte} />
              </div>
            );
          })}
        </Stack>
      )}
      <Divider my="sm" />
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" c="dimmed">
            Propinas
          </Text>
          <Text size="sm" fw={700}>
            {formatearPesos(cobros.propinas)}
          </Text>
        </Group>
        <Group justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            {porConfirmar.monto > 0 && (
              <IconAlertTriangle size={16} color="var(--mantine-color-yellow-4)" />
            )}
            <Text size="sm" c="dimmed">
              Efectivo por confirmar
            </Text>
          </Group>
          <Text size="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>
            {formatearPesos(porConfirmar.monto)}
            {porConfirmar.pagos > 0 && (
              <Text span size="xs" c="dimmed">
                {' '}
                · {porConfirmar.pagos} {porConfirmar.pagos === 1 ? 'pago' : 'pagos'}
              </Text>
            )}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * Barra de 8 px: cuadrada en la base y redondeada 4 px en el extremo del dato; el riel es un tono
 * suave del mismo violeta, para leer cada parte contra el total.
 */
function Barra({ parte }: Readonly<{ parte: number }>) {
  const forma = { borderRadius: '0 4px 4px 0' };
  return (
    <Box h={8} style={{ ...forma, background: 'var(--mantine-color-violeta-light)' }}>
      <Box
        h="100%"
        w={`${Math.round(parte * 1000) / 10}%`}
        style={{ ...forma, background: 'var(--mantine-color-violeta-5)' }}
      />
    </Box>
  );
}

function Punto({ color, children }: Readonly<{ color: string; children: React.ReactNode }>) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={9} h={9} style={{ borderRadius: '50%', background: color }} />
      <Text size="xs" c="dimmed">
        {children}
      </Text>
    </Group>
  );
}
