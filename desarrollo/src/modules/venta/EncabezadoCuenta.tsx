'use client';

import { Button, Group, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { formatearHora } from '@/shared/utilidades/fechas';
import type { EncabezadoCuenta as Cuenta } from './repositorios/cuentas';

const pestanas = [
  { clave: 'pedir', etiqueta: 'Pedir', ruta: '' },
  { clave: 'cuenta', etiqueta: 'Cuenta', ruta: '/detalle' },
  { clave: 'cobrar', etiqueta: 'Cobrar', ruta: '/cobrar' },
] as const;

/** Título de la cuenta y sus pestañas: tomar pedidos, ver el detalle con el saldo y cobrar. */
export function EncabezadoCuenta({
  cuenta,
  activa,
}: Readonly<{ cuenta: Cuenta; activa: (typeof pestanas)[number]['clave'] }>) {
  return (
    <>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Title order={2}>
            {cuenta.mesa !== null ? `Mesa ${cuenta.mesa}` : cuenta.referencia}
          </Title>
          <Text c="dimmed" size="sm">
            Cuenta {cuenta.numero} · {cuenta.ambiente} · desde {formatearHora(cuenta.abiertaEn)}
          </Text>
        </div>
        <Button component={Link} href="/garzon" variant="subtle" size="sm" mih={44}>
          Mesas
        </Button>
      </Group>
      <Group grow gap="xs" component="nav" aria-label="Secciones de la cuenta">
        {pestanas.map((pestana) => (
          <Button
            key={pestana.clave}
            component={Link}
            href={`/garzon/cuenta/${cuenta.numero}${pestana.ruta}`}
            variant={activa === pestana.clave ? 'filled' : 'default'}
            aria-current={activa === pestana.clave ? 'page' : undefined}
            // Tres pestañas en 360 px: con el tamaño grande «Cobrar» no cabía.
            size="md"
            px="xs"
            mih={44}
          >
            {pestana.etiqueta}
          </Button>
        ))}
      </Group>
    </>
  );
}
