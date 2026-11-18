'use client';

import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck,
  IconMinus,
  IconPlus,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson, nuevaClaveDeEnvio } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora } from '@/shared/utilidades/fechas';
import {
  consumoDeLaCuenta,
  DIVISIONES,
  guardarCobroPendiente,
  leerCobroPendiente,
  MEDIOS,
  montoACobrar,
  montoDeItems,
  nombreDelMedio,
  personasQueFaltan,
  problemaDelCobro,
  propinaDe,
  type CobroPendiente,
  type FormaDelMonto,
  type FormaDePropina,
} from './cobro';
import type { MedioDePago } from './cuenta';
import { EncabezadoCuenta } from './EncabezadoCuenta';
import { iconoDelMedio } from './iconos';
import type { DetalleCuenta } from './servicios/cuentas';
import type { PagoHecho } from './servicios/pagos';

const SIN_CONFIRMAR = 'Este cobro quedó sin confirmar. Reintenta: no se cobra dos veces.';

const opcionesDelMonto = [
  { value: 'saldo', label: 'Todo' },
  ...DIVISIONES.map((partes) => ({ value: String(partes), label: `÷${partes}` })),
  { value: 'items', label: 'Ítems' },
  { value: 'libre', label: 'Otro' },
];

const opcionesDePropina = [
  { value: 'sin', label: 'Sin' },
  { value: '10', label: '10 %' },
  { value: '15', label: '15 %' },
  { value: '30', label: '30 %' },
  { value: 'monto', label: 'Otra' },
];

/** En escritorio el cobro no se estira: una columna como la del teléfono, al centro. */
const COLUMNA = { maw: 720, mx: 'auto', w: '100%' } as const;

const leerForma = (valor: string): FormaDelMonto =>
  valor === 'saldo' || valor === 'libre' || valor === 'items'
    ? valor
    : (Number(valor) as FormaDelMonto);

const leerPropina = (valor: string): FormaDePropina =>
  valor === 'sin' || valor === 'monto' ? valor : (Number(valor) as FormaDePropina);

/** «$6.500 + $650 de propina con tarjeta». */
const describir = (cobro: { monto: number; propina: number; medio: MedioDePago }) =>
  `${formatearPesos(cobro.monto)}${
    cobro.propina > 0 ? ` + ${formatearPesos(cobro.propina)} de propina` : ''
  } ${cobro.medio === 'efectivo' ? 'en' : 'con'} ${nombreDelMedio(cobro.medio).toLowerCase()}`;

// HU-24 y HU-25: cobrar la cuenta en uno o varios pagos, cada uno con su medio y su propina, sin que
// un corte de red lo cobre dos veces (RN-13) ni supere el saldo (RN-18).
export function Cobrar({ inicial }: Readonly<{ inicial: DetalleCuenta }>) {
  const { fecha } = inicial;
  const numero = inicial.cuenta.numero;
  const { datos, sinConexion, actualizar } = useTiempoReal(
    `/api/vivo/cuenta?numero=${numero}`,
    inicial,
  );
  const [forma, setForma] = useState<FormaDelMonto>('saldo');
  const [pagadas, setPagadas] = useState(0);
  const [libre, setLibre] = useState('');
  const [elegidas, setElegidas] = useState<Record<string, number>>({});
  const [formaPropina, setFormaPropina] = useState<FormaDePropina>('sin');
  const [propinaLibre, setPropinaLibre] = useState('');
  const [medio, setMedio] = useState<MedioDePago | null>(null);
  const [pendiente, setPendiente] = useState<CobroPendiente | null>(() =>
    leerCobroPendiente(localStorage, fecha, numero),
  );
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState<string | null>(() => (pendiente ? SIN_CONFIRMAR : null));
  const [hecho, setHecho] = useState<PagoHecho | null>(null);

  // Hasta que la consulta en vivo traiga el pago recién hecho, manda lo que respondió el servidor:
  // así la parte siguiente de una división no se calcula un instante con el saldo anterior.
  const atrasado = hecho !== null && !datos.pagos.some((pago) => pago.numero === hecho.numero);
  const saldo = atrasado ? hecho.saldo : datos.saldo;
  const pagado = datos.total - saldo;
  const cerrada = datos.cuenta.cerradaEn !== null || (hecho?.cerrada ?? false);

  // Cobro por ítems: las líneas vigentes de la cuenta, cada una con las unidades que se eligen.
  const lineas = useMemo(
    () =>
      datos.pedidos.flatMap((pedido) =>
        pedido.lineas
          .filter((linea) => linea.anulada === null)
          .map((linea) => ({
            clave: `${pedido.numero}-${linea.linea}`,
            producto: linea.producto,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
          })),
      ),
    [datos.pedidos],
  );
  const porItems = montoDeItems(lineas, elegidas);
  const monto = pendiente?.monto ?? montoACobrar({ forma, pagadas, libre, porItems }, saldo);
  const propina = pendiente?.propina ?? propinaDe(formaPropina, propinaLibre, monto);
  const medioElegido = pendiente?.medio ?? medio;
  const problema = problemaDelCobro(monto, saldo, medioElegido);
  const cierra = monto === saldo;
  const faltan = personasQueFaltan({ forma, pagadas });
  const IconoMedio = medioElegido ? iconoDelMedio[medioElegido] : null;

  async function cobrar() {
    if (cobrando) return;
    let envio = pendiente;
    if (!envio) {
      if (problema || !medio) return;
      envio = { clave: nuevaClaveDeEnvio(), medio, monto, propina };
      // Se guarda antes de enviar: si el teléfono se apaga a mitad de camino, el reintento lleva la
      // misma clave y el servidor devuelve el pago ya registrado (RN-13).
      guardarCobroPendiente(localStorage, fecha, numero, envio);
      setPendiente(envio);
    }
    setCobrando(true);
    setError(null);
    setHecho(null);
    const respuesta = await enviarJson<PagoHecho>('/api/pagos', {
      cuenta: numero,
      claveEnvio: envio.clave,
      medio: envio.medio,
      monto: envio.monto,
      propina: envio.propina,
    });
    setCobrando(false);

    if (respuesta.ok) {
      guardarCobroPendiente(localStorage, fecha, numero, null);
      setPendiente(null);
      setHecho(respuesta.datos);
      // HU-25: en una división, la parte siguiente se calcula con el saldo nuevo y las que faltan.
      if (typeof forma === 'number') setPagadas((anteriores) => anteriores + 1);
      setLibre('');
      setElegidas({});
      setFormaPropina('sin');
      setPropinaLibre('');
      setMedio(null);
      navigator.vibrate?.(80);
      void actualizar();
    } else if (respuesta.incierto) {
      setError(`${respuesta.error} El cobro sigue aquí: reintenta y no se cobra dos veces.`);
    } else {
      // Un rechazo asegura que no se registró nada: el cobro vuelve a ser editable.
      guardarCobroPendiente(localStorage, fecha, numero, null);
      setPendiente(null);
      setError(respuesta.error);
      void actualizar();
    }
  }

  // Al volver la señal se reintenta solo el cobro que quedó sin confirmar.
  const alVolverLaRed = useEffectEvent(() => {
    if (pendiente && !cobrando) void cobrar();
  });
  useEffect(() => {
    const manejar = () => alVolverLaRed();
    window.addEventListener('online', manejar);
    return () => window.removeEventListener('online', manejar);
  }, []);

  if (cerrada && !pendiente) {
    return (
      <Stack gap="sm" {...COLUMNA}>
        <EncabezadoCuenta cuenta={datos.cuenta} activa="cobrar" />
        <CuentaCerrada
          hecho={hecho}
          lugar={datos.cuenta.mesa !== null ? `La mesa ${datos.cuenta.mesa}` : null}
          cerradaEn={datos.cuenta.cerradaEn}
          saldo={datos.saldo}
          total={datos.total}
        />
        <PagosDeLaCuenta pagos={datos.pagos} />
      </Stack>
    );
  }

  return (
    <Stack gap="md" {...COLUMNA}>
      <EncabezadoCuenta cuenta={datos.cuenta} activa="cobrar" />
      <AvisoConexion sinConexion={sinConexion} />

      <Paper withBorder p="md" bg="dark.6">
        <Text size="sm" c="dimmed">
          Saldo por cobrar
        </Text>
        <Text
          fz={38}
          fw={800}
          lh={1.15}
          c="yellow.4"
          aria-label={`Saldo por cobrar: ${formatearPesos(saldo)}`}
        >
          {formatearPesos(saldo)}
        </Text>
        <Group gap="lg" mt={4}>
          <Text size="sm" c="dimmed">
            Total{' '}
            <Text span fw={700} c="var(--mantine-color-text)">
              {formatearPesos(datos.total)}
            </Text>
          </Text>
          <Text size="sm" c="dimmed">
            Pagado{' '}
            <Text span fw={700} c="var(--mantine-color-text)">
              {formatearPesos(pagado)}
            </Text>
          </Text>
        </Group>
        <LoConsumido pedidos={datos.pedidos} />
      </Paper>

      {hecho && (
        <Alert color="green" variant="light" role="status" icon={<IconCircleCheck />}>
          Pago {hecho.numero} {hecho.repetido ? 'ya estaba registrado' : 'registrado'}:{' '}
          {describir(hecho)}.{hecho.medio === 'efectivo' && ' Entrégalo a la administración.'}
        </Alert>
      )}
      {error && (
        <Alert color={pendiente ? 'yellow' : 'red'} variant="light" role="alert">
          {error}
        </Alert>
      )}

      {pendiente ? (
        <Paper withBorder p="md">
          <Text fw={700}>Cobro sin confirmar</Text>
          <Text size="sm" c="dimmed">
            {describir(pendiente)}. Mientras no se confirme no se puede cambiar: así nunca se cobra
            dos veces.
          </Text>
        </Paper>
      ) : (
        <>
          <Paso numero={1} titulo="¿Cuánto paga?">
            <SegmentedControl
              fullWidth
              size="md"
              aria-label="Cuánto paga"
              value={String(forma)}
              onChange={(valor) => {
                setForma(leerForma(valor));
                setPagadas(0);
              }}
              data={opcionesDelMonto}
            />
            {typeof forma === 'number' && (
              <Text size="sm" c="dimmed">
                Parte {Math.min(pagadas + 1, forma)} de {forma}
                {faltan > 1 ? ' · la última parte ajusta el saldo exacto' : ' · paga lo que queda'}
              </Text>
            )}
            {forma === 'libre' && (
              <CampoPesos
                label="Monto que paga"
                placeholder={`Hasta ${formatearPesos(saldo)}`}
                valor={libre}
                alCambiar={setLibre}
                autoFocus
              />
            )}
            {forma === 'items' && (
              <ItemsQuePaga
                lineas={lineas}
                elegidas={elegidas}
                alCambiar={(clave, unidades) =>
                  setElegidas((actuales) => ({ ...actuales, [clave]: unidades }))
                }
                suma={porItems}
                saldo={saldo}
              />
            )}
          </Paso>

          <Paso numero={2} titulo="Propina">
            <SegmentedControl
              fullWidth
              size="md"
              aria-label="Propina"
              value={String(formaPropina)}
              onChange={(valor) => setFormaPropina(leerPropina(valor))}
              data={opcionesDePropina}
            />
            {formaPropina === 'monto' && (
              <CampoPesos
                label="Monto de la propina"
                placeholder="Por ejemplo 2000"
                valor={propinaLibre}
                alCambiar={setPropinaLibre}
              />
            )}
            {typeof formaPropina === 'number' && monto > 0 && (
              <Text size="sm" c="dimmed">
                {formaPropina} % de {formatearPesos(monto)}: {formatearPesos(propina)}
              </Text>
            )}
          </Paso>

          <Paso numero={3} titulo="Medio de pago">
            <SimpleGrid cols={3} spacing="xs">
              {MEDIOS.map(({ valor, etiqueta }) => (
                <BotonMedio
                  key={valor}
                  etiqueta={etiqueta}
                  icono={iconoDelMedio[valor]}
                  elegido={medio === valor}
                  alElegir={() => setMedio(valor)}
                />
              ))}
            </SimpleGrid>
            {medio === 'efectivo' && (
              <Text size="sm" c="dimmed">
                El efectivo queda pendiente hasta que lo entregues a la administración.
              </Text>
            )}
            {medio === 'transferencia' && (
              <Text size="sm" c="dimmed">
                Revisa que la transferencia haya llegado antes de cobrar.
              </Text>
            )}
          </Paso>
        </>
      )}

      <Paper withBorder p="sm" bg="dark.6">
        <Stack gap={4}>
          <Fila etiqueta="Monto" valor={monto} />
          {propina > 0 && <Fila etiqueta="Propina" valor={propina} />}
          <Divider my={2} />
          <Group justify="space-between" wrap="nowrap">
            <Text fw={700}>A recibir</Text>
            <Text fw={800} size="xl" aria-label={`A recibir: ${formatearPesos(monto + propina)}`}>
              {formatearPesos(monto + propina)}
            </Text>
          </Group>
          {monto > 0 && monto <= saldo && (
            <Text size="xs" c="dimmed">
              {cierra
                ? 'Con este pago la cuenta se cierra y la mesa queda libre.'
                : `Después quedan ${formatearPesos(saldo - monto)} por cobrar.`}
            </Text>
          )}
        </Stack>
      </Paper>

      <PagosDeLaCuenta pagos={datos.pagos} />

      {/* Solo el botón queda fijo abajo: así no tapa los pasos en un teléfono de 360 px. */}
      <Box
        pos="sticky"
        bottom={0}
        py="xs"
        style={{
          zIndex: 10,
          background: 'var(--mantine-color-body)',
          borderTop: '1px solid var(--mantine-color-dark-5)',
        }}
      >
        <Button
          fullWidth
          onClick={() => void cobrar()}
          loading={cobrando}
          disabled={!pendiente && problema !== null}
          leftSection={IconoMedio && <IconoMedio size={20} />}
        >
          {pendiente ? 'Reintentar cobro' : `Cobrar ${formatearPesos(monto + propina)}`}
        </Button>
        {!pendiente && problema && (
          <Text size="xs" c="dimmed" ta="center" mt={4}>
            {problema}
          </Text>
        )}
      </Box>
    </Stack>
  );
}

function Paso({
  numero,
  titulo,
  children,
}: Readonly<{ numero: number; titulo: string; children: React.ReactNode }>) {
  return (
    <Stack gap="xs" component="section" aria-label={titulo}>
      <Group gap="xs">
        <ThemeIcon size={24} radius="xl" variant="light">
          <Text size="xs" fw={800}>
            {numero}
          </Text>
        </ThemeIcon>
        <Text fw={700}>{titulo}</Text>
      </Group>
      {children}
    </Stack>
  );
}

function BotonMedio({
  etiqueta,
  icono: Icono,
  elegido,
  alElegir,
}: Readonly<{ etiqueta: string; icono: Icon; elegido: boolean; alElegir: () => void }>) {
  return (
    <UnstyledButton
      onClick={alElegir}
      aria-pressed={elegido}
      aria-label={etiqueta}
      style={{
        minHeight: 68,
        borderRadius: 'var(--mantine-radius-md)',
        border: `1px solid ${elegido ? 'var(--mantine-color-violeta-5)' : 'var(--mantine-color-dark-4)'}`,
        background: elegido ? 'var(--mantine-color-violeta-light)' : 'var(--mantine-color-dark-6)',
        display: 'grid',
        placeItems: 'center',
        padding: '8px 4px',
        gap: 4,
      }}
    >
      <Icono size={24} color={elegido ? 'var(--mantine-color-violeta-3)' : undefined} />
      <Text size="sm" fw={elegido ? 700 : 500} ta="center" lh={1.1}>
        {etiqueta}
      </Text>
    </UnstyledButton>
  );
}

/** CU-18 paso 1: lo consumido, a un toque, para responder «¿qué me están cobrando?». */
function LoConsumido({ pedidos }: Readonly<{ pedidos: DetalleCuenta['pedidos'] }>) {
  const [abierto, setAbierto] = useState(false);
  const lineas = consumoDeLaCuenta(pedidos);
  if (lineas.length === 0) return null;
  const unidades = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  return (
    <Box mt={4}>
      <Button
        variant="subtle"
        size="sm"
        mih={44}
        px={0}
        aria-expanded={abierto}
        onClick={() => setAbierto((antes) => !antes)}
        rightSection={
          <IconChevronDown
            size={16}
            style={{
              transform: abierto ? 'rotate(180deg)' : undefined,
              transition: 'transform 150ms',
            }}
          />
        }
      >
        {abierto
          ? 'Ocultar lo consumido'
          : `Ver lo consumido (${unidades} ${unidades === 1 ? 'ítem' : 'ítems'})`}
      </Button>
      <Collapse expanded={abierto}>
        <Stack gap={4} pt={4}>
          {lineas.map((linea) => (
            <Group key={linea.clave} justify="space-between" wrap="nowrap" gap="xs">
              <Text size="sm" truncate>
                {linea.cantidad} × {linea.producto}
              </Text>
              <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatearPesos(linea.importe)}
              </Text>
            </Group>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

function PagosDeLaCuenta({ pagos }: Readonly<{ pagos: DetalleCuenta['pagos'] }>) {
  if (pagos.length === 0) return null;
  return (
    <Stack gap={6}>
      <Text fw={700} size="sm">
        Pagos de esta cuenta
      </Text>
      {pagos.map((pago) => (
        <Group key={pago.numero} justify="space-between" wrap="nowrap" gap="xs">
          <Text size="sm" c="dimmed" truncate>
            {pago.numero}. {nombreDelMedio(pago.medio)} · {formatearHora(pago.registradoEn)}
          </Text>
          <Text size="sm" fw={600}>
            {formatearPesos(pago.monto)}
            {pago.propina > 0 && ` + ${formatearPesos(pago.propina)}`}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

function Fila({ etiqueta, valor }: Readonly<{ etiqueta: string; valor: number }>) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {etiqueta}
      </Text>
      <Text size="sm" fw={600}>
        {formatearPesos(valor)}
      </Text>
    </Group>
  );
}

/** HU-24 CA3: la cuenta quedó pagada; si fue con este teléfono, el último pago y qué hacer. */
function CuentaCerrada({
  hecho,
  lugar,
  cerradaEn,
  saldo,
  total,
}: Readonly<{
  hecho: PagoHecho | null;
  lugar: string | null;
  cerradaEn: string | null;
  saldo: number;
  total: number;
}>) {
  // La administración puede cerrar una cuenta con saldo (HU-27): no se le dice al cliente que pagó,
  // aunque antes se haya cobrado una parte desde este teléfono.
  const conSaldo = saldo > 0;
  const titulo = conSaldo
    ? `Cerrada con saldo de ${formatearPesos(saldo)}`
    : total === 0
      ? 'Cuenta cerrada sin consumo'
      : 'Cuenta pagada';
  return (
    <Paper withBorder p="lg" ta="center">
      <Stack gap="sm" align="center">
        <ThemeIcon size={64} radius="xl" color={conSaldo ? 'yellow' : 'green'} variant="light">
          {conSaldo ? <IconAlertTriangle size={40} /> : <IconCircleCheck size={40} />}
        </ThemeIcon>
        <Title order={3}>{titulo}</Title>
        {conSaldo && <Text c="dimmed">La cerró la administración sin cobrar ese saldo.</Text>}
        {hecho ? (
          <Text>
            Pago {hecho.numero}: {describir(hecho)}.
          </Text>
        ) : (
          cerradaEn && <Text c="dimmed">Se cerró a las {formatearHora(cerradaEn)}.</Text>
        )}
        {lugar && <Text c="dimmed">{lugar} quedó libre.</Text>}
        {hecho?.medio === 'efectivo' && (
          <Alert color="yellow" variant="light" w="100%">
            Entrega {formatearPesos(hecho.monto + hecho.propina)} en efectivo a la administración.
          </Alert>
        )}
        <Stack gap="xs" w="100%">
          <Button component={Link} href="/garzon" fullWidth>
            Volver a las mesas
          </Button>
          <Button component={Link} href="/garzon/efectivo" variant="default" fullWidth>
            Mi efectivo por entregar
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

/**
 * HU-25: cobro por ítems («yo pago mis dos piscolas»). Se eligen las unidades de cada línea y la
 * suma es el monto. Lo ya cobrado no queda marcado por ítem, así que el tope sigue siendo el saldo.
 */
function ItemsQuePaga({
  lineas,
  elegidas,
  alCambiar,
  suma,
  saldo,
}: Readonly<{
  lineas: { clave: string; producto: string; cantidad: number; precioUnitario: number }[];
  elegidas: Record<string, number>;
  alCambiar: (clave: string, unidades: number) => void;
  suma: number;
  saldo: number;
}>) {
  return (
    <Stack gap={6}>
      {lineas.map((linea) => {
        const unidades = elegidas[linea.clave] ?? 0;
        return (
          <Group key={linea.clave} justify="space-between" wrap="nowrap" gap="xs">
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {linea.producto}
              </Text>
              <Text size="xs" c="dimmed">
                {linea.cantidad} × {formatearPesos(linea.precioUnitario)}
              </Text>
            </div>
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                size={44}
                variant="default"
                disabled={unidades === 0}
                onClick={() => alCambiar(linea.clave, unidades - 1)}
                aria-label={`Quitar una unidad de ${linea.producto}`}
              >
                <IconMinus size={18} />
              </ActionIcon>
              <Text w={36} ta="center" fw={700} aria-live="polite">
                {unidades}
              </Text>
              <ActionIcon
                size={44}
                variant="default"
                disabled={unidades >= linea.cantidad}
                onClick={() => alCambiar(linea.clave, unidades + 1)}
                aria-label={`Sumar una unidad de ${linea.producto}`}
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Group>
          </Group>
        );
      })}
      <Text size="sm" c="dimmed">
        Suman {formatearPesos(suma)}
        {suma > saldo && ` · supera el saldo: se cobra ${formatearPesos(saldo)}`}. Lo ya cobrado se
        descuenta del saldo, no de cada ítem.
      </Text>
    </Stack>
  );
}
