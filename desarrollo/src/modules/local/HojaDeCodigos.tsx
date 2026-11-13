'use client';

import { Box, Button, Group, Text } from '@mantine/core';
import { IconArrowLeft, IconPrinter } from '@tabler/icons-react';
import Link from 'next/link';
import type { CodigosDeMesas } from './servicios/qr';

// La hoja se imprime en blanco y negro aunque la aplicación use el tema oscuro, y la barra de botones
// no sale en el papel. Cada tarjeta mide lo justo para recortarla y dejarla en la mesa.
const estilos = `
  @page { size: A4; margin: 12mm; }
  @media print {
    .solo-pantalla { display: none !important; }
    html, body { background: #fff !important; }
  }
  .hoja-qr svg { width: 100%; height: 100%; display: block; }
`;

/** HU-07 CA3: los códigos de un ambiente listos para imprimir o guardar como PDF. */
export function HojaDeCodigos({ datos }: Readonly<{ datos: CodigosDeMesas }>) {
  const { ambiente, mesas } = datos;

  return (
    <Box bg="white" c="black" mih="100vh" p="md" className="hoja-qr">
      <style>{estilos}</style>
      <Group className="solo-pantalla" justify="space-between" mb="md">
        <Button
          component={Link}
          href={ambiente ? `/admin/qr?ambiente=${ambiente.id}` : '/admin/qr'}
          variant="default"
          mih={44}
          leftSection={<IconArrowLeft size={18} />}
        >
          Volver
        </Button>
        <Button mih={44} leftSection={<IconPrinter size={18} />} onClick={() => window.print()}>
          Imprimir o guardar PDF
        </Button>
      </Group>

      {mesas.length === 0 && <Text>Este ambiente no tiene mesas.</Text>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8mm' }}>
        {mesas.map((mesa) => (
          <div
            key={mesa.id}
            style={{
              border: '1px dashed #888',
              borderRadius: 8,
              padding: '6mm',
              textAlign: 'center',
              breakInside: 'avoid',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700 }}>Mesa {mesa.numero}</div>
            <div style={{ fontSize: 14 }}>{ambiente?.nombre}</div>
            <div
              style={{ width: '55mm', height: '55mm', margin: '4mm auto' }}
              role="img"
              aria-label={`Código QR de la mesa ${mesa.numero}`}
              dangerouslySetInnerHTML={{ __html: mesa.svg }}
            />
            <div style={{ fontSize: 14 }}>Escanea para ver la carta y llamar al garzón</div>
          </div>
        ))}
      </div>
    </Box>
  );
}
