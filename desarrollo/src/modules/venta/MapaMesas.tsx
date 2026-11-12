'use client';

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconArmchair, IconChevronRight, IconUserPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LeyendaPlano,
  PlanoMesas,
  VisorPlano,
  type MesaDibujada,
} from '@/modules/local/PlanoMesas';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { hojaInferior } from '@/shared/ui/hoja';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { duracion, formatearHora } from '@/shared/utilidades/fechas';
import { NuevaCuentaDePie } from './NuevaCuentaDePie';
import type { DetalleCuenta, Mapa } from './servicios/cuentas';

type Mesa = Mapa['mesas'][number];

/** HU-17 CA2: pasados 10 minutos, lo que aún se prepara cuenta como atrasado. */
const ESPERA_ATRASADA = 10 * 60;

const rutaDeCuenta = (numero: number) => `/garzon/cuenta/${numero}`;

const estadoDe = (mesa: Pick<Mesa, 'cuenta' | 'listas'>) =>
  mesa.cuenta === null ? 'libre' : mesa.listas > 0 ? 'lista' : 'ocupada';

// HU-13: el plano del ambiente con cada mesa libre u ocupada, al día cada pocos segundos.
export function MapaMesas({ inicial }: Readonly<{ inicial: Mapa }>) {
  const router = useRouter();
  const [ambienteId, setAmbienteId] = useState(inicial.ambiente.id);
  const { datos, sinConexion } = useTiempoReal(`/api/vivo/mesas?ambiente=${ambienteId}`, inicial);
  const [mesaId, setMesaId] = useState<number | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dePieAbierto, dePie] = useDisclosure(false);
  const ancha = useMediaQuery('(min-width: 62em)');

  const { ambiente, mesas } = datos;
  const seleccionada = mesas.find((mesa) => mesa.id === mesaId);
  const ocupadas = mesas.filter((mesa) => mesa.cuenta !== null).length;

  const dibujadas: MesaDibujada[] = mesas.map((mesa) => {
    const estado = estadoDe(mesa);
    return {
      ...mesa,
      estado,
      atrasada: mesa.esperaMaxima > ESPERA_ATRASADA,
      etiqueta: `Mesa ${mesa.numero}, ${estado === 'libre' ? 'libre' : 'ocupada'}${
        estado === 'lista' ? ', con comandas listas' : ''
      }`,
    };
  });

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
      <EncabezadoPagina
        icono={IconArmchair}
        titulo="Mesas"
        descripcion={`${ambiente.nombre} · ${ocupadas} ocupadas · ${mesas.length - ocupadas} libres · ${datos.dePie.length} de pie`}
      >
        <Button
          size="sm"
          mih={44}
          variant="light"
          leftSection={<IconUserPlus size={18} />}
          onClick={dePie.open}
          disabled={!datos.noche}
        >
          Cliente de pie
        </Button>
      </EncabezadoPagina>

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

      <VisorPlano ancho={ambiente.planoAncho} alto={ambiente.planoAlto} pie={<LeyendaPlano />}>
        {(escala) => (
          <PlanoMesas
            ancho={ambiente.planoAncho}
            alto={ambiente.planoAlto}
            mesas={dibujadas}
            escala={escala}
            seleccionada={mesaId}
            alElegir={elegir}
          />
        )}
      </VisorPlano>

      {datos.dePie.length > 0 && (
        <Stack gap="xs">
          <Text fw={700}>Clientes de pie</Text>
          {datos.dePie.map((cuenta) => (
            <Card
              key={cuenta.numero}
              component={Link}
              href={rutaDeCuenta(cuenta.numero)}
              padding="sm"
              withBorder
            >
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {cuenta.referencia}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Cuenta {cuenta.numero} · {cuenta.garzon} · desde{' '}
                    {cuenta.abiertaEn && formatearHora(cuenta.abiertaEn)}
                  </Text>
                </div>
                <Group gap="xs" wrap="nowrap">
                  {cuenta.listas > 0 && <Badge color="green">Lista</Badge>}
                  <Text fw={700}>{formatearPesos(cuenta.total)}</Text>
                  <IconChevronRight size={18} color="var(--mantine-color-dimmed)" />
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Drawer
        opened={seleccionada !== undefined}
        onClose={() => elegir(null)}
        position={ancha ? 'right' : 'bottom'}
        size={ancha ? 400 : '85%'}
        zIndex={400}
        radius="lg"
        closeButtonProps={{ 'aria-label': 'Cerrar' }}
        // En el teléfono es una hoja que sube solo lo que necesita su contenido.
        styles={ancha ? undefined : hojaInferior}
        title={
          seleccionada && (
            <Group gap="sm">
              <Text fw={700} size="xl">
                Mesa {seleccionada.numero}
              </Text>
              <EstadoMesa mesa={seleccionada} />
            </Group>
          )
        }
      >
        {seleccionada && (
          <PanelMesa
            mesa={seleccionada}
            hayNoche={Boolean(datos.noche)}
            abriendo={abriendo}
            error={error}
            alAbrir={() => void abrirCuenta(seleccionada)}
          />
        )}
      </Drawer>

      <NuevaCuentaDePie ambienteId={ambiente.id} abierto={dePieAbierto} alCerrar={dePie.close} />
    </Stack>
  );
}

function EstadoMesa({ mesa }: Readonly<{ mesa: Mesa }>) {
  const estado = estadoDe(mesa);
  if (estado === 'libre') return <Badge color="gray">Libre</Badge>;
  if (estado === 'lista') return <Badge color="green">Lista para retirar</Badge>;
  return <Badge color="violeta">Ocupada</Badge>;
}

/** Lo que muestra la mesa elegida: abrir cuenta, o su resumen con lo pedido y el total. */
function PanelMesa({
  mesa,
  hayNoche,
  abriendo,
  error,
  alAbrir,
}: Readonly<{
  mesa: Mesa;
  hayNoche: boolean;
  abriendo: boolean;
  error: string | null;
  alAbrir: () => void;
}>) {
  if (mesa.cuenta === null) {
    return (
      <Stack gap="sm">
        {error && (
          <Alert color="red" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Text c="dimmed">Mesa libre. Al abrir la cuenta pasas a tomar el pedido.</Text>
        <Button onClick={alAbrir} loading={abriendo} disabled={!hayNoche} fullWidth>
          Abrir cuenta
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <SimpleGrid cols={2} spacing="xs">
        <Dato etiqueta="Abierta" valor={mesa.abiertaEn ? formatearHora(mesa.abiertaEn) : '—'} />
        <Dato etiqueta="Tiempo" valor={duracion(mesa.abiertaHace ?? 0)} />
        <Dato etiqueta="Cuenta" valor={String(mesa.cuenta)} />
        <Dato etiqueta="Garzón" valor={mesa.garzon ?? '—'} />
      </SimpleGrid>
      {mesa.listas > 0 && (
        <Alert color="green" variant="light">
          {mesa.listas === 1
            ? 'Hay una comanda lista para retirar.'
            : `Hay ${mesa.listas} comandas listas para retirar.`}
        </Alert>
      )}
      <LoPedido cuenta={mesa.cuenta} />
      <Group justify="space-between">
        <Text fw={600}>Total mesa</Text>
        <Text fw={700} size="xl" c="violeta.3">
          {formatearPesos(mesa.total)}
        </Text>
      </Group>
      {mesa.pagado > 0 && (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Pagado {formatearPesos(mesa.pagado)}
          </Text>
          <Text fw={700} c="yellow.4">
            Saldo {formatearPesos(mesa.total - mesa.pagado)}
          </Text>
        </Group>
      )}
      {/* Tres acciones en una hoja de 360 px: con el tamaño grande «Cuenta» y «Cobrar» no cabían. */}
      <SimpleGrid cols={3} spacing="xs">
        <Button
          component={Link}
          href={`${rutaDeCuenta(mesa.cuenta)}/detalle`}
          variant="default"
          size="md"
          px="xs"
          mih={48}
        >
          Cuenta
        </Button>
        <Button
          component={Link}
          href={`${rutaDeCuenta(mesa.cuenta)}/cobrar`}
          variant="light"
          size="md"
          px="xs"
          mih={48}
          disabled={mesa.total === 0}
        >
          Cobrar
        </Button>
        <Button component={Link} href={rutaDeCuenta(mesa.cuenta)} size="md" px="xs" mih={48}>
          Pedir
        </Button>
      </SimpleGrid>
    </Stack>
  );
}

function Dato({ etiqueta, valor }: Readonly<{ etiqueta: string; valor: string }>) {
  return (
    <Paper withBorder p="xs" radius="md" bg="dark.6">
      <Text size="xs" c="dimmed">
        {etiqueta}
      </Text>
      <Text fw={700} truncate>
        {valor}
      </Text>
    </Paper>
  );
}

/** Pedidos realizados de la cuenta, con su precio: se consultan al abrir la mesa. */
function LoPedido({ cuenta }: Readonly<{ cuenta: number }>) {
  const [detalle, setDetalle] = useState<DetalleCuenta | null>(null);
  const [consultada, setConsultada] = useState<number | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/vivo/cuenta?numero=${cuenta}`, { cache: 'no-store' })
      .then((respuesta) => (respuesta.ok ? (respuesta.json() as Promise<DetalleCuenta>) : null))
      .then((datos) => {
        if (!vigente) return;
        setDetalle(datos);
        setConsultada(cuenta);
      })
      .catch(() => vigente && setConsultada(cuenta));
    return () => {
      vigente = false;
    };
  }, [cuenta]);

  if (consultada !== cuenta) return <Loader size="sm" />;
  const lineas = (detalle?.pedidos ?? []).flatMap((p) => p.lineas).filter((l) => !l.anulada);
  if (lineas.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Todavía no hay pedidos.
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        Pedidos realizados
      </Text>
      {lineas.map((linea, i) => (
        <Group key={i} justify="space-between" wrap="nowrap">
          <Text size="sm" truncate>
            {linea.cantidad} × {linea.producto}
          </Text>
          <Text size="sm">{formatearPesos(linea.cantidad * linea.precioUnitario)}</Text>
        </Group>
      ))}
    </Stack>
  );
}
