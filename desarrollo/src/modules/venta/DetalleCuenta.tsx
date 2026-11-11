'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora } from '@/shared/utilidades/fechas';
import type { EstadoComanda, LineaDeCuenta } from './cuenta';
import { EncabezadoCuenta } from './EncabezadoCuenta';
import type { DetalleCuenta as Detalle } from './servicios/cuentas';

const colorDe: Record<EstadoComanda, string> = {
  'en preparación': 'gray',
  lista: 'green',
  entregada: 'violet',
};

const medioDe = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

interface PorAnular {
  pedido: number;
  linea: LineaDeCuenta;
}

// HU-23: lo consumido en cada pedido, el total, lo pagado y el saldo, al día cada pocos segundos.
// HU-22: cada ítem vigente se puede anular mientras la cuenta no tenga pagos.
export function DetalleCuenta({ inicial }: Readonly<{ inicial: Detalle }>) {
  const numero = inicial.cuenta.numero;
  const { datos, sinConexion, actualizar } = useTiempoReal(
    `/api/vivo/cuenta?numero=${numero}`,
    inicial,
  );
  const [porAnular, setPorAnular] = useState<PorAnular | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { cuenta, pedidos, pagos, total, pagado, saldo, seAnula } = datos;

  async function anular() {
    if (!porAnular) return;
    setAnulando(true);
    setError(null);
    // Anular es idempotente: ante un corte se puede repetir sin efecto doble.
    const respuesta = await enviarJson('/api/pedidos/anular', {
      cuenta: numero,
      pedido: porAnular.pedido,
      linea: porAnular.linea.linea,
    });
    setAnulando(false);
    setPorAnular(null);
    if (!respuesta.ok) setError(respuesta.error);
    await actualizar();
  }

  return (
    <Stack gap="sm">
      <EncabezadoCuenta cuenta={cuenta} activa="cuenta" />
      <AvisoConexion sinConexion={sinConexion} />
      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}
      {cuenta.cerradaEn && (
        <Alert color="gray" variant="light">
          Cuenta cerrada a las {formatearHora(cuenta.cerradaEn)}.
        </Alert>
      )}

      <Paper withBorder p="sm">
        <SimpleGrid cols={3} spacing="xs">
          <Cifra etiqueta="Total" valor={total} />
          <Cifra etiqueta="Pagado" valor={pagado} />
          <Cifra etiqueta="Saldo" valor={saldo} destacada />
        </SimpleGrid>
      </Paper>

      {pedidos.length === 0 && <Text c="dimmed">Todavía no hay pedidos en esta cuenta.</Text>}
      {pedidos.map((pedido) => (
        <Card
          key={pedido.numero}
          withBorder
          padding="sm"
          component="section"
          aria-label={`Pedido ${pedido.numero}`}
        >
          <Group justify="space-between" mb={4}>
            <Title order={3} size="h5">
              Pedido {pedido.numero}
            </Title>
            <Text size="sm" c="dimmed">
              {formatearHora(pedido.enviadoEn)} · {pedido.tomadoPor}
            </Text>
          </Group>
          <Stack gap="xs">
            {pedido.lineas.map((linea) => (
              <Group key={linea.linea} justify="space-between" wrap="nowrap" align="center">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    fw={600}
                    td={linea.anulada ? 'line-through' : undefined}
                    c={linea.anulada ? 'dimmed' : undefined}
                  >
                    {linea.cantidad} × {linea.producto}
                  </Text>
                  {linea.nota && (
                    <Text size="xs" c="dimmed">
                      Nota: {linea.nota}
                    </Text>
                  )}
                  {linea.anulada ? (
                    <Text size="xs" c="red.4">
                      Anulado por {linea.anulada.por} a las {formatearHora(linea.anulada.en)}
                    </Text>
                  ) : (
                    <Badge size="sm" variant="light" color={colorDe[linea.estado]}>
                      {linea.estacion}: {linea.estado}
                    </Badge>
                  )}
                </div>
                <Text
                  size="sm"
                  td={linea.anulada ? 'line-through' : undefined}
                  c={linea.anulada ? 'dimmed' : undefined}
                >
                  {formatearPesos(linea.cantidad * linea.precioUnitario)}
                </Text>
                {seAnula && !linea.anulada && (
                  <ActionIcon
                    size={44}
                    variant="subtle"
                    color="red"
                    aria-label={`Anular ${linea.cantidad} × ${linea.producto} del pedido ${pedido.numero}`}
                    onClick={() => setPorAnular({ pedido: pedido.numero, linea })}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                )}
              </Group>
            ))}
          </Stack>
        </Card>
      ))}

      {pagos.length > 0 && (
        <Stack gap="xs">
          <Title order={3} size="h5">
            Pagos
          </Title>
          {pagos.map((pago) => (
            <Paper key={pago.numero} withBorder p="xs">
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm">
                  {medioDe[pago.medio]} · {formatearHora(pago.registradoEn)} · {pago.registradoPor}
                  {pago.medio === 'efectivo' && !pago.confirmado && ' · por entregar a caja'}
                </Text>
                <Text size="sm" fw={600}>
                  {formatearPesos(pago.monto)}
                  {pago.propina > 0 && ` + ${formatearPesos(pago.propina)}`}
                </Text>
              </Group>
            </Paper>
          ))}
          {cuenta.cerradaEn === null && (
            <Text size="xs" c="dimmed">
              Con pagos registrados ya no se anulan ítems (RN-15).
            </Text>
          )}
        </Stack>
      )}

      <Modal
        opened={porAnular !== null}
        onClose={() => setPorAnular(null)}
        title="Anular ítem"
        centered
      >
        {porAnular && (
          <Stack gap="md">
            <Text>
              ¿Anular {porAnular.linea.cantidad} × {porAnular.linea.producto} del pedido{' '}
              {porAnular.pedido}? {porAnular.linea.estacion} lo verá tachado y no se cobrará.
            </Text>
            <Group justify="flex-end" gap="xs">
              <Button variant="default" mih={44} onClick={() => setPorAnular(null)}>
                Volver
              </Button>
              <Button color="red" mih={44} loading={anulando} onClick={() => void anular()}>
                Anular
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

function Cifra({
  etiqueta,
  valor,
  destacada = false,
}: Readonly<{ etiqueta: string; valor: number; destacada?: boolean }>) {
  return (
    <div aria-label={`${etiqueta}: ${formatearPesos(valor)}`} role="group">
      <Text size="xs" c="dimmed">
        {etiqueta}
      </Text>
      <Text
        fw={700}
        size={destacada ? 'xl' : 'md'}
        c={destacada && valor > 0 ? 'yellow.4' : undefined}
      >
        {formatearPesos(valor)}
      </Text>
    </div>
  );
}
