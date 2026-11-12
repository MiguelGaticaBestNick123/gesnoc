'use client';

import { Alert, Stack } from '@mantine/core';
import { IconUsersGroup } from '@tabler/icons-react';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import { ListaDeIngresos, TarjetaIngresos } from './Ingresos';
import type { IngresosDeLaNoche } from './servicios/puerta';

// HU-32 como la pidió el Product Owner: quién entró, a qué hora, con qué ticket, su nombre, su RUT y
// cómo entró (EF, RC, PN o gratis). Sin lo recaudado, que es de la administración.
export function EstadoDeLaPuerta({ inicial }: Readonly<{ inicial: IngresosDeLaNoche }>) {
  const { datos, sinConexion } = useTiempoReal('/api/vivo/puerta', inicial);
  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <EncabezadoPagina
        icono={IconUsersGroup}
        titulo="Estado de la puerta"
        descripcion={
          datos.noche
            ? `${tituloDeFecha(datos.noche)} · quién entró, con su ticket y forma de entrada`
            : 'Quién entró, con su ticket y forma de entrada'
        }
      />
      <AvisoConexion sinConexion={sinConexion} />
      {datos.noche ? (
        <TarjetaIngresos datos={datos}>
          <ListaDeIngresos ingresos={datos.ingresos} />
        </TarjetaIngresos>
      ) : (
        <Alert color="gray" variant="light">
          No hay una noche abierta.
        </Alert>
      )}
    </Stack>
  );
}
