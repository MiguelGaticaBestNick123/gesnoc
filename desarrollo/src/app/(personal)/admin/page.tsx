import { Card, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { entradasNoche, recaudado } from '@/modules/porteria/demostracion';
import { estado } from '@/modules/noche/servicios/noches';
import { cuentasAbiertas, saldoCuenta, totalCuenta } from '@/modules/venta/demostracion';
import { exigirVista } from '@/shared/sesion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearFecha } from '@/shared/utilidades/fechas';

export const metadata = { title: 'Administración · GesNoc' };

// El estado de la noche ya es real; las cifras son de demostración hasta HU-29.
export default async function PaginaAdmin() {
  const actor = await exigirVista('admin');
  const { abierta } = await estado(actor);
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
          {abierta ? `Noche abierta: ${formatearFecha(abierta.fecha)}` : 'Sin noche abierta'} ·
          cifras de demostración
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
