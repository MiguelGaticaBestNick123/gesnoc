'use client';

import { Textarea } from '@mantine/core';
import { CampoPesos } from '@/shared/ui/CampoPesos';

/** Precio de entrada y nota de una noche: los mismos campos al programarla y al editarla. */
export function CamposNoche({ precio, nota }: Readonly<{ precio?: number; nota?: string | null }>) {
  return (
    <>
      <CampoPesos
        name="precioEntrada"
        label="Precio de entrada"
        valorInicial={precio}
        size="md"
        required
      />
      <Textarea
        name="nota"
        label="Nota para el equipo"
        defaultValue={nota ?? ''}
        maxLength={280}
        autosize
        minRows={2}
        size="md"
      />
    </>
  );
}
