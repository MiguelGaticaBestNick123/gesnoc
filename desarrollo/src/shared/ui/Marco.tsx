'use client';

import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Button,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconHome, IconLogout, IconMoonStars } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { salir } from '@/modules/acceso/acciones';
import { AyudaRol } from '@/modules/acceso/AyudaRol';
import { BotonChat } from '@/modules/chat/Chat';
import { gruposDe, rolDeRuta, roles, rutaDe } from '@/modules/acceso/roles';
import { fechaCorta } from '@/shared/utilidades/fechas';

const administracion = roles.find((rol) => rol.clave === 'admin')!;

interface Props {
  /** Qué hace la persona esta noche, por ejemplo «Garzón · Salón». */
  puesto: string;
  /** La administración conserva su menú aunque abra la pantalla de otro rol. */
  esAdministrador: boolean;
  /** Pantalla que le corresponde a la persona según su turno. */
  inicio: string;
  /** Fecha operativa de la noche abierta, si la hay. */
  noche: string | null;
  children: React.ReactNode;
}

function Marca({ subtitulo }: Readonly<{ subtitulo: string }>) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon
        size={38}
        radius="md"
        variant="gradient"
        gradient={{ from: 'violeta.4', to: 'violeta.8', deg: 135 }}
      >
        <IconMoonStars size={22} />
      </ThemeIcon>
      {/* En un teléfono angosto queda solo el ícono: el encabezado lleva el chat, la ayuda y salir. */}
      <Box visibleFrom="xs">
        <Text fw={700} size="lg" lh={1.1}>
          GesNoc
        </Text>
        <Text size="xs" c="dimmed" lh={1.2}>
          {subtitulo}
        </Text>
      </Box>
    </Group>
  );
}

/** Indicador de la noche: el personal opera solo con una noche abierta (RN-05). */
function EstadoNoche({ noche }: Readonly<{ noche: string | null }>) {
  const abierta = noche !== null;
  return (
    <Group
      gap={8}
      px="sm"
      py={6}
      wrap="nowrap"
      role="status"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 999,
        background: 'var(--mantine-color-default)',
      }}
    >
      <Box
        w={8}
        h={8}
        style={{
          borderRadius: '50%',
          background: abierta ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-dark-3)',
          boxShadow: abierta ? '0 0 8px var(--mantine-color-green-5)' : undefined,
        }}
      />
      <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
        {abierta ? `Noche abierta · ${fechaCorta(noche)}` : 'Sin noche abierta'}
      </Text>
    </Group>
  );
}

// Marco común del personal: el menú lateral es el del rol de la ruta. La administración conserva el
// suyo cuando abre la pantalla de otro rol desde «Operación» (pedido del Product Owner, 18 nov). En
// un teléfono el menú se abre con el botón de la barra superior.
export function Marco({ puesto, esAdministrador, inicio, noche, children }: Readonly<Props>) {
  const ruta = usePathname();
  const [abierto, { toggle, close }] = useDisclosure(false);
  const rol = rolDeRuta(ruta);
  const menu = esAdministrador ? administracion : rol;
  const subtitulo =
    esAdministrador && rol && rol !== administracion
      ? `Administración · ${rol.nombre}`
      : (rol?.nombre ?? 'Gestión nocturna');
  const fueraDeSuInicio = ruta !== inicio && !ruta.startsWith(`${inicio}/`);
  // Quien tiene turno y está en otra pantalla (su calendario, su contraseña) ve destacado el camino
  // de vuelta a la suya: antes era un enlace discreto que pasaba desapercibido.
  const volverAlTurno = fueraDeSuInicio && !esAdministrador && inicio !== '/personal';

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 264, breakpoint: 'sm', collapsed: { mobile: !abierto } }}
      padding="md"
    >
      <AppShell.Header
        style={{
          background: 'var(--mantine-color-dark-8)',
          borderColor: 'var(--mantine-color-dark-5)',
        }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={abierto}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              w={44}
              h={44}
              aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={abierto}
            />
            <Box w={{ sm: 232 }}>
              <Marca subtitulo={subtitulo} />
            </Box>
            <Box visibleFrom="sm">
              <EstadoNoche noche={noche} />
            </Box>
          </Group>
          <Group gap="xs" wrap="nowrap">
            {/* Fuera de su pantalla, el camino de vuelta: un ícono en el teléfono, donde el
                encabezado no da para más, y el texto desde 576 px. Los dos miden 44 px (RNF-09).
                Con turno va relleno y dice cuál es su puesto. */}
            {fueraDeSuInicio && (
              <>
                <ActionIcon
                  component={Link}
                  href={inicio}
                  hiddenFrom="xs"
                  size={44}
                  variant={volverAlTurno ? 'filled' : 'subtle'}
                  color={volverAlTurno ? undefined : 'gray'}
                  aria-label={volverAlTurno ? `Mi pantalla: ${puesto}` : 'Mi pantalla'}
                >
                  <IconHome size={20} />
                </ActionIcon>
                <Button
                  component={Link}
                  href={inicio}
                  visibleFrom="xs"
                  variant={volverAlTurno ? 'filled' : 'subtle'}
                  color={volverAlTurno ? undefined : 'gray'}
                  size="sm"
                  mih={44}
                  leftSection={<IconHome size={16} />}
                >
                  {volverAlTurno ? `Mi pantalla: ${puesto}` : 'Mi pantalla'}
                </Button>
              </>
            )}
            {/* El chat es de quien trabaja esta noche y de la administración. */}
            {(esAdministrador || inicio !== '/personal') && <BotonChat />}
            <AyudaRol rol={rol} />
            <form action={salir}>
              <ActionIcon
                type="submit"
                hiddenFrom="xs"
                size={44}
                variant="subtle"
                color="gray"
                aria-label="Salir"
              >
                <IconLogout size={20} />
              </ActionIcon>
              <Button
                type="submit"
                visibleFrom="xs"
                variant="subtle"
                color="gray"
                size="sm"
                mih={44}
                leftSection={<IconLogout size={16} />}
              >
                Salir
              </Button>
            </form>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        style={{
          background: 'var(--mantine-color-dark-8)',
          borderColor: 'var(--mantine-color-dark-5)',
        }}
      >
        <AppShell.Section hiddenFrom="sm" p="md" pb={0}>
          <EstadoNoche noche={noche} />
        </AppShell.Section>
        <AppShell.Section grow component={ScrollArea} p="md">
          <Stack gap="lg">
            {volverAlTurno && (
              <Button
                component={Link}
                href={inicio}
                onClick={close}
                fullWidth
                size="md"
                leftSection={<IconHome size={18} />}
              >
                Ir a mi pantalla
              </Button>
            )}
            {menu &&
              gruposDe(menu).map((grupo) => (
                <Stack key={grupo.titulo ?? 'inicio'} gap={4}>
                  {grupo.titulo && (
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" mb={2}>
                      {grupo.titulo}
                    </Text>
                  )}
                  {grupo.secciones.map((seccion) => {
                    const href = rutaDe(menu, seccion);
                    const Icono = seccion.icono;
                    // Una subpágina (la noche de un día del calendario) marca su sección.
                    const activa =
                      ruta === href || (seccion.ruta !== '' && ruta.startsWith(`${href}/`));
                    return (
                      <NavLink
                        key={href}
                        component={Link}
                        href={href}
                        label={seccion.etiqueta}
                        active={activa}
                        variant="filled"
                        onClick={close}
                        mih={44}
                        fw={activa ? 600 : 500}
                        style={{ borderRadius: 'var(--mantine-radius-md)' }}
                        leftSection={<Icono size={20} stroke={1.7} />}
                      />
                    );
                  })}
                </Stack>
              ))}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ background: 'var(--mantine-color-dark-7)' }}>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
