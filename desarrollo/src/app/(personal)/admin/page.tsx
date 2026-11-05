import { Card, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { entradasNoche, recaudado } from '@/modules/porteria/demostracion';
import { cuentasAbiertas, saldoCuenta, totalCuenta } from '@/modules/venta/demostracion';
import { formatearPesos } from '@/shared/utilidades/dinero';

export const metadata = { title: 'Administración · GesNoc' };

// Resumen de la noche abierta con los datos de demostración; las cifras reales llegan con HU-29.
export default function PaginaAdmin() {
  const vendido = cuentasAbiertas.reduce((suma, c) => suma + totalCuenta(c), 0);
  const porCobrar = cuentasAbiertas.reduce((suma, c) => suma + saldoCuenta(c), 0);
  const indicadores = [
    { etiqueta: 'Cuentas abiertas', valor: String(cuentasAbiertas.length) },
    { etiqueta: 'Vendido', valor: formatearPesos(vendido) },
    { etiqueta: 'Por cobrar', valor: formatearPesos(porCobrar) },
    { etiqueta: 'Entradas', valor: formatearPesos(recaudado(entradasNoche)) },
  ];

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Resumen de la noche</Title>
        <Text c="dimmed" size="sm">
          Noche abierta · local de demostración
        </Text>
      </div>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {indicadores.map((i) => (
          <Card key={i.etiqueta} withBorder>
            <Text size="sm" c="dimmed">
              {i.etiqueta}
            </Text>
            <Text fw={700} size="xl">
              {i.valor}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
