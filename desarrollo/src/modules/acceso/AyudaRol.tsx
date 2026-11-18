'use client';

import { ActionIcon, Drawer, List, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconHelp } from '@tabler/icons-react';
import { ayudaPorRol } from './ayuda';
import type { Rol } from './roles';

/** El botón «?» de la barra superior: unos pocos consejos para usar la pantalla del rol. */
export function AyudaRol({ rol }: Readonly<{ rol: Rol | undefined }>) {
  const [abierta, { open, close }] = useDisclosure(false);
  const ancha = useMediaQuery('(min-width: 48em)');
  const consejos = ayudaPorRol[rol?.clave ?? 'personal'];

  return (
    <>
      <ActionIcon
        size={44}
        variant="subtle"
        color="gray"
        aria-label="Ayuda: cómo se usa esta pantalla"
        onClick={open}
      >
        <IconHelp size={22} />
      </ActionIcon>
      <Drawer
        opened={abierta}
        onClose={close}
        position={ancha ? 'right' : 'bottom'}
        size={ancha ? 420 : 'auto'}
        radius="lg"
        zIndex={400}
        title={
          <Text fw={700} size="lg">
            Cómo se usa · {rol?.nombre ?? 'GesNoc'}
          </Text>
        }
      >
        <List
          spacing="sm"
          pb="md"
          icon={
            <ThemeIcon size={22} radius="xl" variant="light">
              <IconHelp size={14} />
            </ThemeIcon>
          }
        >
          {consejos.map((consejo) => (
            <List.Item key={consejo}>
              <Text size="sm">{consejo}</Text>
            </List.Item>
          ))}
        </List>
      </Drawer>
    </>
  );
}
