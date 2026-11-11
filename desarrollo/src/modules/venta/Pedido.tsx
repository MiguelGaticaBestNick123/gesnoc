'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMinus, IconNote, IconPlus, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { enviarJson, nuevaClaveDeEnvio } from '@/shared/red';
import { paraBuscar } from '@/shared/utilidades/buscar';
import { formatearPesos } from '@/shared/utilidades/dinero';
import {
  agregar,
  BORRADOR_VACIO,
  cambiarCantidad,
  guardarBorrador,
  leerBorrador,
  llaveDeBorrador,
  type Borrador,
} from './borrador';
import { EncabezadoCuenta } from './EncabezadoCuenta';
import type { PantallaPedido } from './servicios/cuentas';
import type { PedidoEnviado } from './servicios/pedidos';

const SIN_CONFIRMAR = 'Este pedido quedó sin confirmar. Reintenta: no se duplica.';

const unir = (nombres: string[]) =>
  nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0];

// HU-15 y HU-16: armar el pedido con pocos toques y enviarlo sin que un corte de red lo duplique.
export function Pedido({ pantalla }: Readonly<{ pantalla: PantallaPedido }>) {
  const { fecha, cuenta, categorias, productos } = pantalla;
  const router = useRouter();
  const llave = llaveDeBorrador(fecha, cuenta.numero);
  const [borrador, setBorrador] = useState<Borrador>(() =>
    leerBorrador(localStorage, llave, fecha),
  );
  const [error, setError] = useState<string | null>(() => (borrador.clave ? SIN_CONFIRMAR : null));
  const [enviado, setEnviado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [categoria, setCategoria] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [notasAbiertas, setNotasAbiertas] = useState<number[]>([]);
  const [verPedido, pedido] = useDisclosure(false);

  useEffect(() => guardarBorrador(localStorage, llave, borrador), [llave, borrador]);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const nombres = useMemo(
    () => new Map(productos.map((p) => [p.id, paraBuscar(p.nombre)])),
    [productos],
  );
  const texto = paraBuscar(busqueda.trim());
  const visibles = productos.filter(
    (p) =>
      (categoria === null || p.categoriaId === categoria) &&
      (!texto || nombres.get(p.id)?.includes(texto)),
  );

  // Con un envío sin confirmar el pedido no se edita: así nunca existen dos claves para el mismo acto.
  const congelado = enviando || borrador.clave !== undefined;
  const unidades = borrador.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  const total = borrador.lineas.reduce(
    (suma, linea) => suma + (porId.get(linea.productoId)?.precio ?? 0) * linea.cantidad,
    0,
  );
  const hayComida = borrador.lineas.some((linea) => porId.get(linea.productoId)?.paraCocina);
  const cantidadDe = (id: number) =>
    borrador.lineas.find((linea) => linea.productoId === id)?.cantidad ?? 0;

  const cambiar = (cambio: (actual: Borrador) => Borrador) => {
    if (!congelado) setBorrador(cambio);
  };

  async function enviar() {
    setError(null);
    setEnviado(null);
    if (borrador.lineas.length === 0) return;
    if (hayComida && borrador.personas < 1) {
      pedido.open();
      setError('¿Cuántas personas? La cocina lo necesita.');
      return;
    }

    const conClave = { ...borrador, clave: borrador.clave ?? nuevaClaveDeEnvio() };
    // Se guarda antes de enviar: si el teléfono se apaga a mitad de camino, el reintento lleva la
    // misma clave y el servidor devuelve el pedido ya registrado (RN-13).
    guardarBorrador(localStorage, llave, conClave);
    setBorrador(conClave);
    setEnviando(true);
    const respuesta = await enviarJson<PedidoEnviado>('/api/pedidos', {
      cuenta: cuenta.numero,
      claveEnvio: conClave.clave,
      personas: hayComida ? conClave.personas : null,
      lineas: conClave.lineas.map(({ productoId, cantidad, nota }) => ({
        productoId,
        cantidad,
        nota,
      })),
    });
    setEnviando(false);

    if (respuesta.ok) {
      const { numero, estaciones, repetido } = respuesta.datos;
      setBorrador(BORRADOR_VACIO);
      setNotasAbiertas([]);
      pedido.close();
      setEnviado(
        `Pedido ${numero} ${repetido ? 'ya estaba enviado' : 'enviado'} a ${unir(estaciones)}`,
      );
      navigator.vibrate?.(80);
    } else if (respuesta.incierto) {
      setError(`${respuesta.error} El pedido sigue aquí: reintenta y no se duplica.`);
    } else {
      // Un rechazo asegura que no se registró nada: el pedido vuelve a ser editable.
      setBorrador((actual) => ({ ...actual, clave: undefined }));
      setError(respuesta.error);
    }
  }

  // Al volver la señal se reintenta solo el envío que quedó sin confirmar.
  const alVolverLaRed = useEffectEvent(() => {
    if (borrador.clave && !enviando) void enviar();
  });
  useEffect(() => {
    const manejar = () => alVolverLaRed();
    window.addEventListener('online', manejar);
    return () => window.removeEventListener('online', manejar);
  }, []);

  async function cerrarCuentaVacia() {
    if (!window.confirm('¿Cerrar esta cuenta? Solo se puede si no tiene consumo ni pagos.')) return;
    const respuesta = await enviarJson('/api/cuentas/cerrar', { cuenta: cuenta.numero });
    if (respuesta.ok) router.push('/garzon');
    else setError(respuesta.error);
  }

  const titulo = cuenta.mesa !== null ? `Mesa ${cuenta.mesa}` : cuenta.referencia;
  const botonEnviar = borrador.clave ? 'Reintentar envío' : `Enviar · ${formatearPesos(total)}`;

  if (cuenta.cerradaEn) {
    return (
      <Stack gap="md">
        <Title order={2}>{titulo}</Title>
        <Alert color="gray" variant="light">
          La cuenta {cuenta.numero} ya está cerrada.
        </Alert>
        <Button component={Link} href="/garzon" variant="default">
          Volver a las mesas
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <EncabezadoCuenta cuenta={cuenta} activa="pedir" />

      {error && (
        <Alert color={borrador.clave ? 'yellow' : 'red'} variant="light" role="alert">
          <Stack gap="xs">
            <Text size="sm">{error}</Text>
            {borrador.clave && (
              <Button size="sm" mih={44} onClick={enviar} loading={enviando}>
                Reintentar envío
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {enviado && (
        <Alert color="green" variant="light" role="status">
          {enviado}
        </Alert>
      )}

      <TextInput
        aria-label="Buscar producto"
        placeholder="Buscar producto"
        leftSection={<IconSearch size={16} />}
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.currentTarget.value)}
        size="md"
      />
      <ScrollArea type="never">
        <Group gap="xs" wrap="nowrap" w="max-content">
          {[{ id: null, nombre: 'Todo' }, ...categorias].map((c) => (
            <Button
              key={c.id ?? 'todo'}
              size="sm"
              mih={44}
              variant={categoria === c.id ? 'filled' : 'default'}
              onClick={() => setCategoria(c.id)}
            >
              {c.nombre}
            </Button>
          ))}
        </Group>
      </ScrollArea>

      <SimpleGrid cols={2} spacing="xs">
        {visibles.map((producto) => {
          const cantidad = cantidadDe(producto.id);
          return (
            <UnstyledButton
              key={producto.id}
              onClick={() =>
                cambiar((actual) => ({ ...actual, lineas: agregar(actual.lineas, producto.id) }))
              }
              disabled={congelado || producto.sinDestino}
              aria-label={`Agregar ${producto.nombre}`}
            >
              <Paper
                withBorder
                p="sm"
                mih={68}
                style={{
                  opacity: producto.sinDestino ? 0.5 : 1,
                  borderColor: cantidad ? 'var(--mantine-color-violet-6)' : undefined,
                }}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start" gap={4}>
                  <Text size="sm" fw={600} lineClamp={2}>
                    {producto.nombre}
                  </Text>
                  {cantidad > 0 && <Badge>{cantidad}</Badge>}
                </Group>
                <Text size="sm" c="dimmed">
                  {producto.sinDestino
                    ? 'Sin barra en este ambiente'
                    : formatearPesos(producto.precio)}
                </Text>
              </Paper>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
      {visibles.length === 0 && <Text c="dimmed">No hay productos que coincidan.</Text>}

      {unidades === 0 && !congelado && (
        <Button variant="subtle" color="red" size="sm" mih={44} onClick={cerrarCuentaVacia}>
          Cerrar cuenta sin consumo
        </Button>
      )}

      <Paper withBorder p="xs" pos="sticky" bottom={0} style={{ zIndex: 10 }}>
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="default"
            size="md"
            mih={48}
            onClick={pedido.open}
            disabled={unidades === 0}
            aria-label={`Ver pedido (${unidades})`}
          >
            Pedido ({unidades})
          </Button>
          <Button
            size="md"
            mih={48}
            style={{ flex: 1 }}
            onClick={enviar}
            loading={enviando}
            disabled={unidades === 0}
          >
            {botonEnviar}
          </Button>
        </Group>
      </Paper>

      <Drawer
        opened={verPedido}
        onClose={pedido.close}
        position="bottom"
        size="auto"
        title={`Pedido · ${formatearPesos(total)}`}
      >
        <Stack gap="sm">
          {error && (
            <Alert color={borrador.clave ? 'yellow' : 'red'} variant="light">
              {error}
            </Alert>
          )}
          {borrador.lineas.map((linea) => {
            const producto = porId.get(linea.productoId);
            const nombre = producto?.nombre ?? 'Producto no disponible';
            const conNota = linea.nota !== '' || notasAbiertas.includes(linea.productoId);
            const sumar = (delta: number) =>
              cambiar((actual) => ({
                ...actual,
                lineas: cambiarCantidad(actual.lineas, linea.productoId, delta),
              }));
            return (
              <Stack key={linea.productoId} gap={4}>
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {nombre}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatearPesos((producto?.precio ?? 0) * linea.cantidad)}
                    </Text>
                  </div>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      size={44}
                      variant="default"
                      aria-label={`Quitar un ${nombre}`}
                      onClick={() => sumar(-1)}
                      disabled={congelado}
                    >
                      <IconMinus size={18} />
                    </ActionIcon>
                    <Text w={24} ta="center" fw={700}>
                      {linea.cantidad}
                    </Text>
                    <ActionIcon
                      size={44}
                      variant="default"
                      aria-label={`Sumar un ${nombre}`}
                      onClick={() => sumar(1)}
                      disabled={congelado}
                    >
                      <IconPlus size={18} />
                    </ActionIcon>
                    <ActionIcon
                      size={44}
                      variant={conNota ? 'light' : 'subtle'}
                      aria-label={`Escribir nota para ${nombre}`}
                      onClick={() =>
                        setNotasAbiertas((abiertas) => [...abiertas, linea.productoId])
                      }
                      disabled={congelado}
                    >
                      <IconNote size={18} />
                    </ActionIcon>
                  </Group>
                </Group>
                {conNota && (
                  <TextInput
                    aria-label={`Nota para ${nombre}`}
                    placeholder="Sin hielo, alergia…"
                    value={linea.nota}
                    maxLength={140}
                    disabled={congelado}
                    onChange={(evento) => {
                      const nota = evento.currentTarget.value;
                      cambiar((actual) => ({
                        ...actual,
                        lineas: actual.lineas.map((l) =>
                          l.productoId === linea.productoId ? { ...l, nota } : l,
                        ),
                      }));
                    }}
                  />
                )}
              </Stack>
            );
          })}

          {hayComida && (
            <Group justify="space-between">
              <Text fw={600}>Personas (cocina)</Text>
              <Group gap={4} wrap="nowrap">
                <ActionIcon
                  size={44}
                  variant="default"
                  aria-label="Una persona menos"
                  disabled={congelado || borrador.personas <= 0}
                  onClick={() =>
                    cambiar((actual) => ({ ...actual, personas: Math.max(0, actual.personas - 1) }))
                  }
                >
                  <IconMinus size={18} />
                </ActionIcon>
                <Text w={24} ta="center" fw={700} aria-label="Personas">
                  {borrador.personas}
                </Text>
                <ActionIcon
                  size={44}
                  variant="default"
                  aria-label="Una persona más"
                  disabled={congelado || borrador.personas >= 50}
                  onClick={() =>
                    cambiar((actual) => ({ ...actual, personas: actual.personas + 1 }))
                  }
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Group>
            </Group>
          )}

          <Button onClick={enviar} loading={enviando} disabled={unidades === 0}>
            {borrador.clave ? 'Reintentar envío' : `Enviar pedido · ${formatearPesos(total)}`}
          </Button>
          {!congelado && unidades > 0 && (
            <Button variant="subtle" color="red" onClick={() => setBorrador(BORRADOR_VACIO)}>
              Vaciar pedido
            </Button>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}
