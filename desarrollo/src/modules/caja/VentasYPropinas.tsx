'use client';

import {
  Alert,
  Avatar,
  Badge,
  Card,
  Divider,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconCalculator,
  IconChartBar,
  IconCoin,
  IconDoorEnter,
  IconReceipt2,
  IconWallet,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { colorDelRol, nombreDelRol } from '@/modules/noche/nombres';
import { MEDIOS, nombreDelMedio } from '@/modules/venta/cobro';
import { iconoDelMedio } from '@/modules/venta/iconos';
import { Cifra } from '@/shared/ui/Cifra';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import { formatearDocumento } from '@/shared/utilidades/rut';
import { DesgloseEsperado } from './Arqueo';
import { describirDiferencia } from './calculos';
import type { VentasYPropinas as Datos } from './servicios/caja';
import { iniciales } from '@/shared/utilidades/texto';
import { TituloTarjeta } from '@/shared/ui/TituloTarjeta';
import { FilasDeEntradas } from '@/modules/porteria/FilasDeEntradas';

// HU-29: lo vendido y lo cobrado por medio de pago, las propinas de cada ambiente con la parte de
// cada persona, las entradas y la caja. Las cifras de la caja son las del arqueo (CA2) y se cumple
// vendido = cobrado + por cobrar + cerrado con saldo.
export function VentasYPropinas({ datos }: Readonly<{ datos: Datos }>) {
  const router = useRouter();
  const { detalle, elegida } = datos;

  return (
    <Stack gap="md" maw={1100}>
      <EncabezadoPagina
        icono={IconChartBar}
        titulo="Ventas y propinas"
        descripcion="Las cifras de cada noche, por medio de pago y por ambiente."
      />
      {elegida && (
        <NativeSelect
          label="Noche"
          value={elegida.fecha}
          onChange={(evento) => router.push(`/admin/ventas?fecha=${evento.currentTarget.value}`)}
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
          <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="sm">
            <Cifra
              compacta
              icono={IconReceipt2}
              color="violeta"
              etiqueta="Vendido"
              valor={formatearPesos(detalle.totales.vendido)}
            />
            <Cifra
              compacta
              icono={IconWallet}
              color="green"
              etiqueta="Cobrado"
              valor={formatearPesos(detalle.totales.cobrado)}
              detalle={`+ ${formatearPesos(detalle.totales.propinas)} de propinas`}
            />
            <Cifra
              compacta
              icono={IconCoin}
              color="yellow"
              etiqueta="Por cobrar"
              valor={formatearPesos(detalle.totales.porCobrar)}
            />
            <Cifra
              compacta
              icono={IconReceipt2}
              color="red"
              etiqueta="Cerrado con saldo"
              valor={formatearPesos(detalle.totales.cerradoConSaldo)}
            />
          </SimpleGrid>
          <Text size="sm" c="dimmed">
            Lo vendido se reparte en cobrado, por cobrar y cerrado con saldo. El control del
            efectivo es el arqueo, en la tarjeta «Caja».
          </Text>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card withBorder padding="md">
              <TituloTarjeta icono={IconWallet}>Cobrado por medio de pago</TituloTarjeta>
              <Stack gap="sm">
                {MEDIOS.map(({ valor: medio }) => {
                  const fila = detalle.medios.find((m) => m.medio === medio);
                  const Icono = iconoDelMedio[medio];
                  return (
                    <Group key={medio} justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon variant="light" radius="xl" size={34}>
                          <Icono size={18} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={600}>
                            {nombreDelMedio(medio)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {`${fila?.pagos ?? 0} ${fila?.pagos === 1 ? 'pago' : 'pagos'} · ${formatearPesos(fila?.propina ?? 0)} de propina`}
                          </Text>
                        </div>
                      </Group>
                      <Text fw={700}>{formatearPesos(fila?.monto ?? 0)}</Text>
                    </Group>
                  );
                })}
              </Stack>
            </Card>

            <Card withBorder padding="md">
              <TituloTarjeta icono={IconCoin}>Propinas por ambiente</TituloTarjeta>
              <Text size="xs" c="dimmed" mb="sm">
                Se reparten entre los garzones y barman con turno en el ambiente. Cocina y guardia
                no reciben.
              </Text>
              <Stack gap="md">
                {detalle.ambientes.map((ambiente) => (
                  <div key={ambiente.ambienteId}>
                    <Group justify="space-between" mb={6}>
                      <Text fw={700}>{ambiente.ambiente}</Text>
                      <Badge variant="light" size="lg" tt="none">
                        {formatearPesos(ambiente.propinas)}
                      </Badge>
                    </Group>
                    {ambiente.reparto.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        Nadie tuvo turno de garzón o barra aquí: la propina queda sin repartir.
                      </Text>
                    ) : (
                      <Stack gap={6}>
                        {ambiente.reparto.map((persona) => (
                          <Group key={persona.usuarioId} justify="space-between" wrap="nowrap">
                            <Group gap="sm" wrap="nowrap">
                              <Avatar size={30} radius="xl" color={colorDelRol[persona.rol]}>
                                {iniciales(persona.nombre)}
                              </Avatar>
                              <Text size="sm">
                                {persona.nombre}{' '}
                                <Text span size="xs" c="dimmed">
                                  · {nombreDelRol[persona.rol]}
                                </Text>
                              </Text>
                            </Group>
                            <Text size="sm" fw={700}>
                              {formatearPesos(persona.parte)}
                            </Text>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </div>
                ))}
              </Stack>
            </Card>

            <Card withBorder padding="md">
              <TituloTarjeta icono={IconDoorEnter}>Entradas</TituloTarjeta>
              <Stack gap="sm">
                <FilasDeEntradas entradas={detalle.entradas} />
                {detalle.pendientes.length > 0 && (
                  <>
                    <Divider label="Deben su entrada (PN)" labelPosition="left" />
                    {detalle.pendientes.map((persona) => (
                      <Group key={persona.documento} justify="space-between" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} truncate>
                            {persona.nombre} {persona.apellido}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatearDocumento(persona.documento)} · ticket {persona.ticket}
                          </Text>
                        </div>
                        <Text size="sm" fw={700}>
                          {formatearPesos(persona.monto)}
                        </Text>
                      </Group>
                    ))}
                  </>
                )}
              </Stack>
            </Card>

            <Card withBorder padding="md">
              <TituloTarjeta icono={IconCalculator}>Caja</TituloTarjeta>
              {detalle.esperado ? (
                <Stack gap="sm">
                  <DesgloseEsperado esperado={detalle.esperado} />
                  {detalle.conteo?.contado !== null && detalle.conteo?.contado !== undefined ? (
                    <Text size="sm">
                      Contado {formatearPesos(detalle.conteo.contado)} por{' '}
                      {detalle.conteo.contadoPor}:{' '}
                      {describirDiferencia(detalle.conteo.contado - detalle.esperado.total)}.
                      {detalle.conteo.nota && ` Nota: «${detalle.conteo.nota}».`}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      La caja todavía no se cuenta.
                    </Text>
                  )}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  Esta noche no tiene arqueo.
                </Text>
              )}
            </Card>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
