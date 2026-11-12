'use client';

import { Alert, Anchor, Badge, Card, Divider, Group, Stack, Text, Textarea } from '@mantine/core';
import { IconCalculator } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { contarCaja } from './acciones';
import { describirDiferencia } from './calculos';
import type { Esperado } from './repositorios/caja';
import type { PantallaArqueo } from './servicios/caja';

const colorDeDiferencia = (diferencia: number) => {
  if (diferencia === 0) return 'green';
  return diferencia < 0 ? 'red' : 'yellow';
};

function Linea({ etiqueta, monto }: Readonly<{ etiqueta: string; monto: number }>) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {etiqueta}
      </Text>
      <Text size="sm" fw={600}>
        {formatearPesos(monto)}
      </Text>
    </Group>
  );
}

/** RN-19, desglosado: lo que debería haber en la caja y de dónde sale cada peso. */
export function DesgloseEsperado({ esperado }: Readonly<{ esperado: Esperado }>) {
  return (
    <Stack gap={6}>
      <Linea etiqueta="Fondo de caja" monto={esperado.fondo} />
      <Linea
        etiqueta={`Pagos en efectivo confirmados (${esperado.cantidadPagos})`}
        monto={esperado.pagos}
      />
      <Linea etiqueta="Propinas de esos pagos" monto={esperado.propinas} />
      <Linea
        etiqueta={`Entradas en efectivo, EF (${esperado.cantidadEntradas})`}
        monto={esperado.entradas}
      />
      <Divider my={4} />
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700}>Esperado</Text>
        <Text fw={800} fz={24} aria-label={`Esperado: ${formatearPesos(esperado.total)}`}>
          {formatearPesos(esperado.total)}
        </Text>
      </Group>
    </Stack>
  );
}

// HU-28: el sistema calcula el efectivo esperado y, si lo contado no cuadra, exige una nota que
// explique la diferencia (RN-19 y RN-20). Se puede volver a contar mientras la noche siga abierta.
export function Arqueo({ datos }: Readonly<{ datos: PantallaArqueo }>) {
  const contadoAntes = datos.conteo?.contado;
  const [digitos, setDigitos] = useState(
    contadoAntes === null || contadoAntes === undefined ? '' : String(contadoAntes),
  );

  if (!datos.noche || !datos.esperado) {
    return (
      <Stack gap="md">
        <EncabezadoPagina icono={IconCalculator} titulo="Arqueo" />
        <Alert color="gray" variant="light">
          No hay una noche abierta.
        </Alert>
      </Stack>
    );
  }

  const esperado = datos.esperado;
  const diferencia = digitos === '' ? null : Number(digitos) - esperado.total;
  return (
    <Stack gap="md" maw={720}>
      <EncabezadoPagina
        icono={IconCalculator}
        titulo="Arqueo"
        descripcion="Cuenta el efectivo de la caja. Si no cuadra con el esperado, explica la diferencia."
      />

      {datos.sinConfirmar > 0 && (
        <Alert color="yellow" variant="light">
          {datos.sinConfirmar === 1
            ? 'Hay 1 pago en efectivo sin confirmar: no está en el esperado hasta que lo recibas.'
            : `Hay ${datos.sinConfirmar} pagos en efectivo sin confirmar: no están en el esperado hasta que los recibas.`}{' '}
          <Anchor component={Link} href="/admin/efectivo" size="sm">
            Confirmar efectivo
          </Anchor>
        </Alert>
      )}

      <Card withBorder padding="md">
        <Text fw={700} mb="sm">
          Efectivo esperado
        </Text>
        <DesgloseEsperado esperado={esperado} />
      </Card>

      <Card withBorder padding="md">
        <FormularioAccion accion={contarCaja} textoEnviar="Guardar conteo">
          <CampoPesos
            name="contado"
            label="Efectivo contado"
            valor={digitos}
            alCambiar={setDigitos}
            size="lg"
            required
          />
          {diferencia !== null && (
            <Group gap="xs">
              <Text size="sm">Diferencia:</Text>
              <Badge color={colorDeDiferencia(diferencia)} size="lg" variant="light" tt="none">
                {describirDiferencia(diferencia)}
              </Badge>
            </Group>
          )}
          <Textarea
            name="nota"
            label="Nota"
            description="Obligatoria si el contado no cuadra con el esperado."
            defaultValue={datos.conteo?.nota ?? ''}
            maxLength={500}
            autosize
            minRows={2}
            size="md"
            required={diferencia !== null && diferencia !== 0}
          />
        </FormularioAccion>
        {datos.conteo?.contado !== null && datos.conteo?.contado !== undefined && (
          <Text size="sm" c="dimmed" mt="sm">
            Último conteo: {formatearPesos(datos.conteo.contado)}, por {datos.conteo.contadoPor} (
            {describirDiferencia(datos.conteo.contado - esperado.total)} con el esperado de ahora).
          </Text>
        )}
      </Card>
    </Stack>
  );
}
