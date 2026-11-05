'use client';

import { Badge, Group, NavLink, Stack, Text, ThemeIcon } from '@mantine/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const secciones = [
  { href: '/mesas', etiqueta: 'Mesas', icono: 'M' },
  { href: '/estaciones', etiqueta: 'Estaciones', icono: 'E' },
  { href: '/caja', etiqueta: 'Caja', icono: 'C' },
  { href: '/puerta', etiqueta: 'Puerta', icono: 'P' },
  { href: '/turnos', etiqueta: 'Turnos', icono: 'T' },
];

export function Navegacion() {
  const ruta = usePathname();
  return (
    <Stack justify="space-between" h="100%">
      <Stack gap="xs">
        <Group gap="sm" mb="md">
          <ThemeIcon size="lg" radius="md" variant="filled">
            <Text fw={700}>G</Text>
          </ThemeIcon>
          <div>
            <Text fw={700}>GesNoc</Text>
            <Text size="xs" c="dimmed">
              Gestión nocturna
            </Text>
          </div>
        </Group>
        {secciones.map((s) => (
          <NavLink
            key={s.href}
            component={Link}
            href={s.href}
            label={s.etiqueta}
            active={ruta.startsWith(s.href)}
            leftSection={
              <ThemeIcon size="sm" radius="sm" variant="light">
                <Text size="xs" fw={700}>
                  {s.icono}
                </Text>
              </ThemeIcon>
            }
          />
        ))}
      </Stack>
      <Group gap="xs">
        <Badge color="green" variant="dot">
          Noche abierta
        </Badge>
        <Text size="xs" c="dimmed">
          Demostración
        </Text>
      </Group>
    </Stack>
  );
}
