'use client';

import {
  Alert,
  Card,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconBell,
  IconChartDots,
  IconDoorEnter,
  IconReceipt2,
  IconShoppingBag,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { formas, FORMAS_DE_ENTRADA } from '@/modules/porteria/formas';
import { Cifra } from '@/shared/ui/Cifra';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import { ColumnasPorHora } from './ColumnasPorHora';
import { formatoEspera } from './indicadores';
import type { IndicadoresDeLaNoche } from './servicios/indicadores';

const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const personas = (n: number) => cantidad(n, 'persona', 'personas');

/** Una tarjeta del panel: qué mide y para qué sirve, en una línea, y su contenido. */
function Indicador({
  titulo,
  paraQue,
  children,
}: Readonly<{ titulo: string; paraQue: string; children: React.ReactNode }>) {
  return (
    <Card withBorder padding="md" component="section" aria-label={titulo}>
      <Title order={2} size="h4">
        {titulo}
      </Title>
      <Text size="sm" c="dimmed" mb="sm">
        {paraQue}
      </Text>
      {children}
    </Card>
  );
}

/**
 * Indicadores de la noche para la administración: ventas e ingresos por hora, tiempos de
 * preparación por estación y la respuesta a los llamados. Se calculan de lo registrado, en vivo
 * durante la noche y para comparar noches después.
 */
export function PanelIndicadores({ datos }: Readonly<{ datos: IndicadoresDeLaNoche }>) {
  const router = useRouter();
  const { elegida, detalle } = datos;

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconChartDots}
        titulo="Indicadores"
        descripcion="Cómo funcionó la noche: ventas, puerta, preparación y llamados."
      />
      {elegida && (
        <NativeSelect
          label="Noche"
          value={elegida.fecha}
          onChange={(evento) =>
            router.push(`/admin/indicadores?fecha=${evento.currentTarget.value}`)
          }
          size="md"
          maw={360}
          data={datos.noches.map((noche) => ({
            value: noche.fecha,
            label: `${tituloDeFecha(noche.fecha)}${noche.cerrada ? '' : ' (abierta)'}`,
          }))}
        />
      )}
      {!detalle ? (
        <Alert color="gray" variant="light">
          Todavía no hay noches abiertas.
        </Alert>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            <Cifra
              compacta
              icono={IconShoppingBag}
              color="violeta"
              etiqueta="Vendido"
              valor={formatearPesos(detalle.cuentas.vendido)}
              detalle={cantidad(detalle.cuentas.total, 'cuenta', 'cuentas')}
            />
            <Cifra
              compacta
              icono={IconReceipt2}
              color="violeta"
              etiqueta="Consumo por cuenta"
              valor={formatearPesos(detalle.cuentas.ticketPromedio)}
              detalle={
                detalle.cuentas.duracionMediana === null
                  ? 'Ninguna cuenta cerrada'
                  : `Una cuenta dura ${formatoEspera(detalle.cuentas.duracionMediana)}`
              }
            />
            <Cifra
              compacta
              icono={IconDoorEnter}
              color="violeta"
              etiqueta="Entraron"
              valor={personas(detalle.ingresos)}
            />
            <Cifra
              compacta
              icono={IconBell}
              color="violeta"
              etiqueta="Llamados atendidos"
              valor={`${detalle.llamados.atendidos} de ${detalle.llamados.total}`}
              detalle={
                detalle.llamados.mediana === null
                  ? undefined
                  : `Respuesta típica: ${formatoEspera(detalle.llamados.mediana)}`
              }
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Indicador
              titulo="Ventas por hora"
              paraQue="Las horas de más consumo: cuándo reforzar la barra y cuándo cerrar la cocina."
            >
              <ColumnasPorHora
                titulo="Vendido"
                puntos={detalle.ventasPorHora}
                formato={formatearPesos}
              />
            </Indicador>

            <Indicador
              titulo="Ingresos por hora"
              paraQue="Cuándo llega la gente a la puerta, para el turno del guardia y el aforo."
            >
              <ColumnasPorHora
                titulo="Personas"
                puntos={detalle.ingresosPorHora}
                formato={personas}
              />
              <Group gap="md" mt="xs">
                {FORMAS_DE_ENTRADA.map((forma) => (
                  <Text key={forma} size="sm">
                    <Text span fw={700}>
                      {formas[forma].codigo}
                    </Text>{' '}
                    {detalle.ingresosPorForma[forma]}
                  </Text>
                ))}
              </Group>
            </Indicador>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Indicador
              titulo="Tiempo de preparación"
              paraQue="Desde que el garzón envía el pedido hasta que la estación lo marca listo."
            >
              {detalle.preparacion.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Sin comandas esta noche.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={320}>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Estación</Table.Th>
                        <Table.Th ta="right">Listas</Table.Th>
                        <Table.Th ta="right">Típico</Table.Th>
                        <Table.Th ta="right">9 de cada 10</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {detalle.preparacion.map((fila) => (
                        <Table.Tr key={fila.estacion}>
                          <Table.Td>
                            {fila.estacion}
                            {fila.pendientes > 0 && (
                              <Text size="xs" c="dimmed">
                                {fila.pendientes} sin terminar
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td ta="right">{fila.listas}</Table.Td>
                          <Table.Td ta="right">
                            {fila.mediana === null ? '—' : formatoEspera(fila.mediana)}
                          </Table.Td>
                          <Table.Td ta="right">
                            {fila.p90 === null ? '—' : `≤ ${formatoEspera(fila.p90)}`}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Indicador>

            <Indicador
              titulo="Llamados de las mesas"
              paraQue="Cuánto espera un cliente desde que llama al garzón hasta que lo atienden."
            >
              {detalle.llamados.total === 0 ? (
                <Text size="sm" c="dimmed">
                  Ninguna mesa llamó esta noche.
                </Text>
              ) : (
                <Stack gap={4}>
                  <Text>
                    {cantidad(detalle.llamados.total, 'llamado', 'llamados')} ·{' '}
                    {cantidad(detalle.llamados.atendidos, 'atendido', 'atendidos')}
                    {detalle.llamados.total > detalle.llamados.atendidos &&
                      ` · ${detalle.llamados.total - detalle.llamados.atendidos} sin atender`}
                  </Text>
                  {detalle.llamados.mediana !== null && (
                    <Text>Respuesta típica: {formatoEspera(detalle.llamados.mediana)}</Text>
                  )}
                  {detalle.llamados.maxima !== null && (
                    <Text c="dimmed" size="sm">
                      La espera más larga: {formatoEspera(detalle.llamados.maxima)}
                    </Text>
                  )}
                </Stack>
              )}
            </Indicador>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
