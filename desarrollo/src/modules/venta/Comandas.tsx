'use client';

import { Alert, Badge, Box, Button, Card, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconBell, IconListCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { avisar, useSonido } from '@/shared/navegador/sonido';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { minutos, nivelDeEspera, nuevos, colorDeEspera, haceCuanto } from './cola';
import { claveDeComanda, type MiComanda } from './cuenta';
import type { MisComandas } from './servicios/colas';
import { SinNocheAbierta } from '@/shared/ui/SinNocheAbierta';

const URL_COMANDAS = '/api/vivo/comandas';
const RUTA_COMANDAS = '/garzon/comandas';
/** El aviso abierto se achica solo a la campana de la barra superior pasado este tiempo. */
const ACHICAR_SOLO_MS = 12_000;

/** Los mismos colores de espera que ve la estación en su cola (HU-17 CA2). */
/** HU-21: entregar una comanda; mientras la consulta no lo confirma, ya no se muestra como lista. */
function useEntregar(actualizar: () => Promise<void>) {
  const [entregando, setEntregando] = useState<string | null>(null);
  const [entregadas, setEntregadas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function entregar(comanda: MiComanda) {
    const clave = claveDeComanda(comanda);
    setEntregando(clave);
    setError(null);
    // Entregar es idempotente: ante un corte basta con volver a tocar.
    const respuesta = await enviarJson('/api/comandas/entregada', {
      pedido: comanda.pedido,
      estacionId: comanda.estacionId,
    });
    setEntregando(null);
    if (respuesta.ok) setEntregadas((actuales) => [...actuales, clave]);
    else setError(respuesta.error);
    await actualizar();
  }

  const pendientes = (listas: MiComanda[]) =>
    listas.filter((c) => !entregadas.includes(claveDeComanda(c)));
  return { entregar, entregando, error, pendientes };
}

/**
 * HU-20: el aviso de comanda lista, en todas las pantallas del garzón. Flota sobre la pantalla sin
 * moverla (un aviso que empuja el contenido haría perder el toque que el garzón estaba dando) y suena
 * cuando llega una nueva.
 */
export function AvisosGarzon({ inicial }: Readonly<{ inicial: MisComandas }>) {
  const ruta = usePathname();
  const { datos, actualizar } = useTiempoReal(URL_COMANDAS, inicial);
  const { entregar, entregando, error, pendientes } = useEntregar(actualizar);
  const [postergadas, setPostergadas] = useState<string[]>([]);
  useSonido();

  const vistas = useRef(inicial.listas.map(claveDeComanda));
  useEffect(() => {
    const actuales = datos.listas.map(claveDeComanda);
    if (nuevos(vistas.current, actuales).length > 0) avisar(880);
    vistas.current = actuales;
  }, [datos.listas]);

  const listas = pendientes(datos.listas);
  // Como una notificación: avisa, y a los pocos segundos se achica solo para no tapar la pantalla.
  const claves = listas.map(claveDeComanda).join(',');
  useEffect(() => {
    if (!claves) return;
    const temporizador = setTimeout(() => setPostergadas(claves.split(',')), ACHICAR_SOLO_MS);
    return () => clearTimeout(temporizador);
  }, [claves]);

  if (ruta === RUTA_COMANDAS || listas.length === 0) return null;
  // «Después» lo achica; una comanda nueva lo vuelve a abrir.
  const achicado = listas.every((c) => postergadas.includes(claveDeComanda(c)));
  const primera = listas[0]!;

  // Achicado vive en la barra superior, junto a «Salir»: ahí no tapa ningún botón de la pantalla.
  if (achicado) {
    return (
      <Box pos="fixed" top={8} right={{ base: 64, xs: 116 }} style={{ zIndex: 201 }}>
        <Button
          radius="xl"
          color="green"
          size="sm"
          mih={40}
          leftSection={<IconBell size={16} />}
          onClick={() => setPostergadas([])}
          aria-label={`${listas.length} ${listas.length === 1 ? 'comanda lista' : 'comandas listas'} para retirar`}
        >
          {listas.length}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      pos="fixed"
      top={64}
      right={8}
      left="calc(var(--app-shell-navbar-offset, 0px) + 8px)"
      style={{ zIndex: 150 }}
    >
      <Paper
        shadow="lg"
        p="sm"
        withBorder
        role="region"
        aria-label="Comanda lista para retirar"
        style={{ borderColor: 'var(--mantine-color-green-6)', borderWidth: 2 }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text fw={700}>
            Pedido {primera.pedido} listo · {primera.ubicacion}
          </Text>
          {listas.length > 1 && <Badge color="green">{listas.length}</Badge>}
        </Group>
        <Text size="sm">
          {primera.estacion}: {primera.resumen}
        </Text>
        {error && (
          <Text size="sm" c="red.4" role="alert">
            {error}
          </Text>
        )}
        <Group gap="xs" mt="xs" grow>
          <Button
            variant="default"
            mih={44}
            onClick={() => setPostergadas(listas.map(claveDeComanda))}
          >
            Después
          </Button>
          {listas.length > 1 && (
            <Button component={Link} href={RUTA_COMANDAS} variant="default" mih={44}>
              Ver todas
            </Button>
          )}
          <Button
            color="green"
            mih={44}
            loading={entregando === claveDeComanda(primera)}
            onClick={() => void entregar(primera)}
          >
            Entregada
          </Button>
        </Group>
      </Paper>
    </Box>
  );
}

/** HU-20 y HU-21: todas las comandas del garzón, listas para retirar y en preparación. */
export function MisComandasVista({ inicial }: Readonly<{ inicial: MisComandas }>) {
  const { datos, sinConexion, actualizar } = useTiempoReal(URL_COMANDAS, inicial);
  const { entregar, entregando, error, pendientes } = useEntregar(actualizar);
  const listas = pendientes(datos.listas);

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconListCheck}
        titulo="Comandas"
        descripcion={`${listas.length} ${listas.length === 1 ? 'lista' : 'listas'} para retirar · ${datos.enPreparacion.length} en preparación`}
      />
      <AvisoConexion sinConexion={sinConexion} />
      {error && (
        <Alert color="red" variant="light" role="alert">
          {error}
        </Alert>
      )}
      {!datos.noche && <SinNocheAbierta />}

      <Title order={3} size="h5">
        Listas para retirar
      </Title>
      {listas.length === 0 && <Text c="dimmed">Nada por retirar.</Text>}
      {listas.map((comanda) => (
        <Card
          key={claveDeComanda(comanda)}
          withBorder
          padding="sm"
          component="article"
          aria-label={`Pedido ${comanda.pedido}, ${comanda.estacion}`}
          style={{ borderColor: 'var(--mantine-color-green-6)' }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Text fw={700}>
              Pedido {comanda.pedido} · {comanda.ubicacion}
            </Text>
            <Text size="sm" c="dimmed">
              {haceCuanto(comanda.listaHace ?? 0)}
            </Text>
          </Group>
          <Text size="sm">
            {comanda.estacion}: {comanda.resumen}
          </Text>
          <Button
            mt="xs"
            color="green"
            mih={44}
            fullWidth
            loading={entregando === claveDeComanda(comanda)}
            onClick={() => void entregar(comanda)}
            aria-label={`Marcar entregado el pedido ${comanda.pedido} de ${comanda.estacion}`}
          >
            Entregada
          </Button>
        </Card>
      ))}

      {datos.enPreparacion.length > 0 && (
        <Stack gap="xs">
          <Title order={3} size="h5">
            En preparación
          </Title>
          {datos.enPreparacion.map((comanda) => {
            const color = colorDeEspera[nivelDeEspera(comanda.espera)];
            return (
              <Paper
                key={claveDeComanda(comanda)}
                withBorder
                p="xs"
                pl="sm"
                style={{ borderLeft: `3px solid var(--mantine-color-${color}-6)` }}
              >
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>
                      Pedido {comanda.pedido} · {comanda.ubicacion}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {comanda.estacion}: {comanda.resumen}
                    </Text>
                  </div>
                  <Badge
                    color={color}
                    variant={color === 'gray' ? 'light' : 'filled'}
                    size="lg"
                    style={{ flexShrink: 0 }}
                  >
                    {minutos(comanda.espera)} min
                  </Badge>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
