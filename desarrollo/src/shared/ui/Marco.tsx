'use client';

import { Anchor, AppShell, Burger, Group, NavLink, Stack, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { rolDeRuta, rutaDe } from '@/modules/acceso/roles';

// Marco común del personal: el menú lateral cambia según el rol de la ruta. En un
// teléfono el menú se abre con el botón de la barra superior.
export function Marco({ children }: Readonly<{ children: React.ReactNode }>) {
  const ruta = usePathname();
  const [abierto, { toggle, close }] = useDisclosure(false);
  const rol = rolDeRuta(ruta);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !abierto } }}
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

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          {rol?.secciones.map((seccion) => {
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
                leftSection={
                  <ThemeIcon size="sm" radius="sm" variant="light">
                    <Icono size={14} />
                  </ThemeIcon>
                }
              />
            );
          })}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
