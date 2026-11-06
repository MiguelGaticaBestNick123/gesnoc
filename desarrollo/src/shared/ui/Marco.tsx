'use client';

import {
  Anchor,
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { gruposDe, rolDeRuta, rutaDe } from '@/modules/acceso/roles';

// Marco común del personal: el menú lateral cambia según el rol de la ruta. En un
// teléfono el menú se abre con el botón de la barra superior.
export function Marco({ children }: Readonly<{ children: React.ReactNode }>) {
  const ruta = usePathname();
  const [abierto, { toggle, close }] = useDisclosure(false);
  const rol = rolDeRuta(ruta);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !abierto } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={abierto}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Abrir menú"
            />
            <Text fw={700}>GesNoc</Text>
            {rol && (
              <Text size="sm" c="dimmed">
                {rol.nombre}
              </Text>
            )}
          </Group>
          <Anchor component={Link} href="/" size="sm">
            Cambiar rol
          </Anchor>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <AppShell.Section grow component={ScrollArea} p="md">
          <Stack gap="md">
            {rol &&
              gruposDe(rol).map((grupo) => (
                <Stack key={grupo.titulo ?? 'inicio'} gap={4}>
                  {grupo.titulo && (
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm">
                      {grupo.titulo}
                    </Text>
                  )}
                  {grupo.secciones.map((seccion) => {
                    const href = rutaDe(rol, seccion);
                    const Icono = seccion.icono;
                    return (
                      <NavLink
                        key={href}
                        component={Link}
                        href={href}
                        label={seccion.etiqueta}
                        active={ruta === href}
                        onClick={close}
                        mih={44}
                        leftSection={
                          <ThemeIcon size="sm" radius="sm" variant="light">
                            <Icono size={14} />
                          </ThemeIcon>
                        }
                      />
                    );
                  })}
                </Stack>
              ))}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
