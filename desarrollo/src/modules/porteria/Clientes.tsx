'use client';

import { Button, Card, SegmentedControl, Stack, TextInput } from '@mantine/core';
import { IconHistory, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import type { TipoDocumento } from '@/shared/utilidades/rut';
import { HistorialPorDocumento } from './HistorialCliente';

/** HU-35 y HU-36: buscar a un cliente por su documento para ver su historial o reportarlo. */
export function Clientes() {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('rut');
  const [documento, setDocumento] = useState('');
  const [consulta, setConsulta] = useState<{
    tipoDocumento: TipoDocumento;
    documento: string;
    vez: number;
  } | null>(null);

  return (
    <Stack gap="md" maw={640}>
      <EncabezadoPagina
        icono={IconHistory}
        titulo="Clientes"
        descripcion="Visitas y reportes de cada cliente. Solo los ven el guardia y la administración."
      />
      <Card withBorder padding="md">
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!documento.trim()) return;
            setConsulta((anterior) => ({
              tipoDocumento,
              documento,
              vez: (anterior?.vez ?? 0) + 1,
            }));
          }}
        >
          <Stack gap="xs">
            <SegmentedControl
              value={tipoDocumento}
              onChange={(valor) => setTipoDocumento(valor as TipoDocumento)}
              aria-label="Tipo de documento"
              fullWidth
              data={[
                { value: 'rut', label: 'RUT' },
                { value: 'extranjero', label: 'Extranjero' },
              ]}
            />
            <TextInput
              label="Documento"
              placeholder={tipoDocumento === 'rut' ? '12.345.678-5' : 'Letras y números'}
              value={documento}
              onChange={(evento) => setDocumento(evento.currentTarget.value)}
              autoComplete="off"
              size="md"
            />
            <Button type="submit" mih={44} leftSection={<IconSearch size={18} />}>
              Buscar
            </Button>
          </Stack>
        </form>
      </Card>
      {consulta && (
        <Card withBorder padding="md">
          <HistorialPorDocumento
            key={consulta.vez}
            tipoDocumento={consulta.tipoDocumento}
            documento={consulta.documento}
          />
        </Card>
      )}
    </Stack>
  );
}
