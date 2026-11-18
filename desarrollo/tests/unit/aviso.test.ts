import { describe, expect, it } from 'vitest';
import { enlaceDeWhatsApp, mensajeDeLaNoche } from '@/modules/noche/aviso';

describe('aviso de la noche por WhatsApp', () => {
  it('arma el mensaje con la fecha, la entrada, la nota, los premios, los eventos y el enlace', () => {
    const mensaje = mensajeDeLaNoche(
      {
        fecha: '2026-11-20',
        precioEntrada: 8000,
        nota: 'Entrada gratis hasta las 00:00',
        premios: [{ ambiente: 'Salón', premio: '1 × Botella de ron añejo' }],
        eventos: [{ hora: '01:00', nombre: 'Show de salsa' }],
      },
      'https://gesnoc.example',
    );
    expect(mensaje.split('\n')).toEqual([
      expect.stringMatching(/^\*Viernes, 20 de noviembre\*: abrimos\.$/i),
      'Entrada $8.000.',
      'Entrada gratis hasta las 00:00',
      'Sorteo en Salón: 1 × Botella de ron añejo.',
      '01:00 · Show de salsa',
      'Marca si puedes venir en GesNoc: https://gesnoc.example',
    ]);
  });

  it('el enlace abre WhatsApp con el texto codificado', () => {
    expect(enlaceDeWhatsApp('Hola, ¿vienes?')).toBe(
      'https://wa.me/?text=Hola%2C%20%C2%BFvienes%3F',
    );
  });
});
