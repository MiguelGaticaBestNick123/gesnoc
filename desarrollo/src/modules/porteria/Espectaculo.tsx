'use client';

import { Box, Button, Stack, Text } from '@mantine/core';
import { useEffect } from 'react';
import type { Ganador } from './servicios/sorteo';

export type FaseSorteo =
  | { tipo: 'cuenta'; valor: number }
  | { tipo: 'giro'; valor: number }
  | { tipo: 'ganador'; ganador: Ganador };

const COLORES = ['#8462ff', '#f7b21e', '#fd7e14', '#2fbf71', '#e64980', '#4dabf7'];

/** Un número «al azar» que siempre es el mismo para el mismo papel: el render queda puro. */
const azar = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const PAPELES = Array.from({ length: 70 }, (_, i) => ({
  izquierda: azar(i, 1) * 100,
  retraso: azar(i, 2) * 0.8,
  duracion: 2.4 + azar(i, 3) * 1.8,
  ancho: 6 + azar(i, 4) * 8,
  giro: azar(i, 5) * 720 - 360,
  color: COLORES[i % COLORES.length]!,
}));

// La lluvia de papeles y la entrada de cada número; quien pidió menos movimiento no la ve.
const ESTILOS = `
  .confeti { position: absolute; top: -20px; border-radius: 2px; animation-name: confeti-cae;
    animation-timing-function: linear; animation-fill-mode: forwards; }
  @keyframes confeti-cae { to { transform: translateY(110vh) rotate(var(--giro)); opacity: 0.9; } }
  .sorteo-entra { animation: sorteo-entra 0.45s ease-out; }
  @keyframes sorteo-entra { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .confeti { display: none; } .sorteo-entra { animation: none; } }
`;

function Confeti() {
  return (
    <Box aria-hidden pos="absolute" inset={0} style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      {PAPELES.map((papel, i) => (
        <span
          key={i}
          className="confeti"
          style={
            {
              left: `${papel.izquierda}%`,
              width: papel.ancho,
              height: papel.ancho * 1.6,
              background: papel.color,
              animationDelay: `${papel.retraso}s`,
              animationDuration: `${papel.duracion}s`,
              '--giro': `${papel.giro}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </Box>
  );
}

/**
 * HU-37: el sorteo como espectáculo, para proyectarlo o grabarlo en el local: cuenta regresiva, el
 * número que gira cada vez más lento y el ganador con su premio. El ganador lo eligió el servidor
 * antes de terminar el giro; la pantalla solo lo revela.
 */
export function Espectaculo({
  ambiente,
  participantes,
  fase,
  alCerrar,
}: Readonly<{
  ambiente: string;
  participantes: number;
  fase: FaseSorteo;
  alCerrar: () => void;
}>) {
  useEffect(() => {
    if (fase.tipo !== 'ganador') return;
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [fase.tipo, alCerrar]);

  return (
    <Box
      role="dialog"
      aria-modal
      aria-label={`Sorteo de ${ambiente}`}
      pos="fixed"
      inset={0}
      style={{
        zIndex: 500,
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at 50% 40%, #2d2361 0%, #0b0b13 70%)',
      }}
    >
      <style>{ESTILOS}</style>
      {fase.tipo === 'ganador' && <Confeti />}
      <Stack gap="xs" align="center" ta="center" px="md" pos="relative">
        <Text size="xl" fw={700} c="dimmed" tt="uppercase">
          Sorteo · {ambiente}
        </Text>
        {fase.tipo === 'cuenta' && (
          <Text key={fase.valor} className="sorteo-entra" fw={800} fz={180} lh={1} c="white">
            {fase.valor}
          </Text>
        )}
        {fase.tipo === 'giro' && (
          <Text
            fw={800}
            fz={180}
            lh={1}
            c="violeta.3"
            aria-hidden
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fase.valor}
          </Text>
        )}
        {fase.tipo === 'ganador' && (
          <div role="status">
            <Text size="xl" fw={700} c="yellow.4">
              ¡Tenemos ganador!
            </Text>
            <Text
              className="sorteo-entra"
              fw={800}
              fz={180}
              lh={1}
              c="yellow.4"
              aria-label={`Número ganador ${fase.ganador.ticket}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fase.ganador.ticket}
            </Text>
            <Text fw={700} fz={36} c="white">
              {fase.ganador.nombre} {fase.ganador.apellido}
            </Text>
            <Text size="xl" c="white" mt="xs">
              {fase.ganador.premio}
            </Text>
            <Text c="dimmed" mt={4}>
              Entre {participantes} {participantes === 1 ? 'ticket' : 'tickets'} de la noche
            </Text>
            <Button mt="xl" size="lg" variant="default" onClick={alCerrar}>
              Cerrar
            </Button>
          </div>
        )}
      </Stack>
    </Box>
  );
}
