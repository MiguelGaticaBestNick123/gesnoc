'use client';

import { TextInput, type TextInputProps } from '@mantine/core';
import { useState } from 'react';
import { formatearPesos } from '@/shared/utilidades/dinero';

interface Props extends Omit<TextInputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  valorInicial?: number;
  /** Solo en formularios controlados, como el cobro. */
  valor?: string;
  alCambiar?: (digitos: string) => void;
}

/**
 * Campo de dinero. Con `type="number"` el navegador toma el punto como decimal y «150.000» llega
 * como 150: una caja de mil veces menos sin que nada lo advierta. Aquí solo entran dígitos y debajo
 * se repite el monto con formato, para que un cero de más o de menos se vea al tiro.
 */
export function CampoPesos({ valorInicial, valor, alCambiar, description, ...campo }: Props) {
  const [interno, setInterno] = useState(valorInicial === undefined ? '' : String(valorInicial));
  const digitos = valor ?? interno;

  const cambiar = (texto: string) => {
    const limpio = texto.replace(/\D/g, '').slice(0, 9);
    if (valor === undefined) setInterno(limpio);
    alCambiar?.(limpio);
  };

  const eco = digitos.length >= 4 ? `= ${formatearPesos(Number(digitos))}` : null;

  return (
    <TextInput
      {...campo}
      inputMode="numeric"
      autoComplete="off"
      leftSection="$"
      value={digitos}
      onChange={(evento) => cambiar(evento.currentTarget.value)}
      description={[description, eco].filter(Boolean).join(' · ') || undefined}
    />
  );
}
