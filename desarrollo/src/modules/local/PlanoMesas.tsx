'use client';

import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import {
  IconMaximize,
  IconMinimize,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from '@tabler/icons-react';
import { useEffect, useId, useRef, useState } from 'react';
import { escalaParaAjustar, ladoDeToque, MARGEN, sillasDe, type Mesa } from './geometria';

export type EstadoDibujo = 'libre' | 'ocupada' | 'lista' | 'neutra' | 'invalida';

export interface MesaDibujada extends Mesa {
  /** Nombre accesible, por ejemplo «Mesa 4, libre»: lo leen el lector de pantalla y las pruebas. */
  etiqueta: string;
  estado: EstadoDibujo;
  /** Algo de esta mesa espera más de 10 minutos en una estación. */
  atrasada?: boolean;
}

interface Colores {
  mesa: string;
  borde: string;
  silla: string;
  texto: string;
  brillo: string | null;
}

const colores: Record<EstadoDibujo, Colores> = {
  libre: { mesa: '#232336', borde: '#3f3f5c', silla: '#2c2c45', texto: '#cfcfe0', brillo: null },
  ocupada: {
    mesa: '#2d2361',
    borde: '#8462ff',
    silla: '#3b3075',
    texto: '#ffffff',
    brillo: '#8462ff',
  },
  lista: {
    mesa: '#143826',
    borde: '#2fbf71',
    silla: '#1d4a35',
    texto: '#ffffff',
    brillo: '#2fbf71',
  },
  neutra: { mesa: '#26263b', borde: '#57577c', silla: '#2e2e48', texto: '#e2e2ee', brillo: null },
  invalida: {
    mesa: '#3b1c25',
    borde: '#fa5252',
    silla: '#4b2431',
    texto: '#ffffff',
    brillo: '#fa5252',
  },
};

export interface Edicion {
  alMover: (id: number, posX: number, posY: number) => void;
  alRedimensionar: (id: number, ancho: number, alto: number) => void;
}

interface PropsPlano {
  ancho: number;
  alto: number;
  mesas: MesaDibujada[];
  escala: number;
  seleccionada?: number | null;
  alElegir?: (id: number) => void;
  edicion?: Edicion;
}

interface Arrastre {
  id: number;
  tipo: 'mover' | 'tamano';
  x: number;
  y: number;
  inicial: Mesa;
  movio: boolean;
}

/** Más de 3 px de movimiento ya es arrastrar; menos es un toque para elegir la mesa. */
const UMBRAL_PX = 3;

/** Dibujo del plano de un ambiente con sus mesas. Escala con el espacio y no pierde nitidez. */
export function PlanoMesas({
  ancho,
  alto,
  mesas,
  escala,
  seleccionada = null,
  alElegir,
  edicion,
}: Readonly<PropsPlano>) {
  const prefijo = useId().replaceAll(':', '');
  const arrastre = useRef<Arrastre | null>(null);
  const toque = ladoDeToque(escala);
  const radioTirador = Math.max(12, toque / 2);

  const empezar = (evento: React.PointerEvent, mesa: Mesa, tipo: Arrastre['tipo']) => {
    if (!edicion || evento.button !== 0) return;
    evento.stopPropagation();
    (evento.currentTarget as Element).setPointerCapture(evento.pointerId);
    arrastre.current = {
      id: mesa.id,
      tipo,
      x: evento.clientX,
      y: evento.clientY,
      inicial: mesa,
      movio: false,
    };
  };

  const mover = (evento: React.PointerEvent) => {
    const actual = arrastre.current;
    if (!actual || !edicion) return;
    const dx = evento.clientX - actual.x;
    const dy = evento.clientY - actual.y;
    if (!actual.movio && Math.hypot(dx, dy) < UMBRAL_PX) return;
    actual.movio = true;
    const { inicial } = actual;
    if (actual.tipo === 'mover') {
      edicion.alMover(inicial.id, inicial.posX + dx / escala, inicial.posY + dy / escala);
      return;
    }
    // El tirador está en la esquina de la mesa girada: el movimiento se lleva a sus ejes.
    const angulo = (-inicial.rotacion * Math.PI) / 180;
    const localX = (dx * Math.cos(angulo) - dy * Math.sin(angulo)) / escala;
    const localY = (dx * Math.sin(angulo) + dy * Math.cos(angulo)) / escala;
    edicion.alRedimensionar(inicial.id, inicial.ancho + localX, inicial.alto + localY);
  };

  const terminar = (evento: React.PointerEvent) => {
    const actual = arrastre.current;
    arrastre.current = null;
    if (!actual) return;
    (evento.currentTarget as Element).releasePointerCapture?.(evento.pointerId);
    if (!actual.movio && actual.tipo === 'mover') alElegir?.(actual.id);
  };

  const ancho2 = ancho + 2 * MARGEN;
  const alto2 = alto + 2 * MARGEN;

  return (
    <svg
      width={ancho2 * escala}
      height={alto2 * escala}
      viewBox={`${-MARGEN} ${-MARGEN} ${ancho2} ${alto2}`}
      style={{ display: 'block', fontFamily: 'var(--fuente-gesnoc), system-ui, sans-serif' }}
      role="group"
      aria-label="Plano de mesas"
    >
      <defs>
        <pattern id={`${prefijo}-grilla`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#24243a" strokeWidth="1" />
        </pattern>
        <filter id={`${prefijo}-brillo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* Piso y muros del ambiente. */}
      <rect x={0} y={0} width={ancho} height={alto} rx={16} fill="#141422" />
      <rect x={0} y={0} width={ancho} height={alto} rx={16} fill={`url(#${prefijo}-grilla)`} />
      <rect
        x={0}
        y={0}
        width={ancho}
        height={alto}
        rx={16}
        fill="none"
        stroke="#3a3a55"
        strokeWidth={6}
      />

      {mesas.map((mesa) => {
        const color = colores[mesa.estado];
        const elegida = mesa.id === seleccionada;
        const redonda = mesa.forma === 'redonda';
        const borde = elegida ? '#d8ceff' : color.borde;
        const tamanoNumero = Math.min(36, Math.max(14, Math.min(mesa.ancho, mesa.alto) * 0.42));
        const ladoX = Math.max(mesa.ancho + 44, toque);
        const ladoY = Math.max(mesa.alto + 44, toque);
        const cuerpo = (props: React.SVGProps<SVGElement>) =>
          redonda ? (
            <circle r={mesa.ancho / 2} {...(props as React.SVGProps<SVGCircleElement>)} />
          ) : (
            <rect
              x={-mesa.ancho / 2}
              y={-mesa.alto / 2}
              width={mesa.ancho}
              height={mesa.alto}
              rx={10}
              {...(props as React.SVGProps<SVGRectElement>)}
            />
          );

        return (
          <g
            key={mesa.id}
            transform={`translate(${mesa.posX + mesa.ancho / 2} ${mesa.posY + mesa.alto / 2}) rotate(${mesa.rotacion})`}
            role="button"
            tabIndex={0}
            aria-label={mesa.etiqueta}
            aria-pressed={edicion ? elegida : undefined}
            style={{
              cursor: edicion ? 'grab' : 'pointer',
              touchAction: edicion ? 'none' : 'auto',
              outline: 'none',
            }}
            onClick={edicion ? undefined : () => alElegir?.(mesa.id)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                alElegir?.(mesa.id);
              }
            }}
            onPointerDown={(evento) => empezar(evento, mesa, 'mover')}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
          >
            {/* Área de toque: al menos 44 px en pantalla aunque la mesa se vea chica (RNF-09). */}
            <rect x={-ladoX / 2} y={-ladoY / 2} width={ladoX} height={ladoY} fill="transparent" />
            {sillasDe(mesa).map((silla, i) => (
              <rect
                key={i}
                x={silla.x}
                y={silla.y}
                width={silla.ancho}
                height={silla.alto}
                rx={4}
                fill={color.silla}
                stroke={elegida ? '#d8ceff' : color.borde}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                transform={
                  silla.rotacion
                    ? `rotate(${silla.rotacion} ${silla.x + silla.ancho / 2} ${silla.y + silla.alto / 2})`
                    : undefined
                }
              />
            ))}
            {(color.brillo || elegida) &&
              cuerpo({
                fill: 'none',
                stroke: elegida ? '#b39dff' : (color.brillo ?? undefined),
                strokeWidth: 10,
                opacity: 0.7,
                filter: `url(#${prefijo}-brillo)`,
              })}
            {cuerpo({ fill: color.mesa, stroke: borde, strokeWidth: elegida ? 4 : 2.5 })}
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={tamanoNumero}
              fontWeight={700}
              fill={color.texto}
              transform={`rotate(${-mesa.rotacion})`}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {mesa.numero}
            </text>
            {mesa.estado === 'lista' && (
              <Insignia
                x={mesa.ancho / 2}
                y={-mesa.alto / 2}
                rotacion={mesa.rotacion}
                color="#2fbf71"
              >
                <path
                  d="M -5 0 L -1.5 3.5 L 5 -3.5"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Insignia>
            )}
            {mesa.atrasada && mesa.estado !== 'lista' && (
              <Insignia
                x={mesa.ancho / 2}
                y={-mesa.alto / 2}
                rotacion={mesa.rotacion}
                color="#f59f0b"
              >
                <circle r={5.5} fill="none" stroke="#1b1b1b" strokeWidth={1.8} />
                <path
                  d="M 0 -3 L 0 0 L 2.5 1.5"
                  fill="none"
                  stroke="#1b1b1b"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Insignia>
            )}
            {edicion && elegida && (
              <g
                // Fuera de la esquina, en diagonal: su área de toque (44 px) no tapa la mesa, que
                // en el teléfono se ve chica y se arrastraría el tirador en vez de la mesa.
                transform={`translate(${mesa.ancho / 2 + radioTirador * 0.75} ${mesa.alto / 2 + radioTirador * 0.75})`}
                role="button"
                aria-label={`Cambiar el tamaño de la mesa ${mesa.numero}`}
                style={{ cursor: 'nwse-resize', touchAction: 'none' }}
                onPointerDown={(evento) => empezar(evento, mesa, 'tamano')}
                onPointerMove={mover}
                onPointerUp={terminar}
                onPointerCancel={terminar}
              >
                <circle r={radioTirador} fill="transparent" />
                <line
                  x1={-radioTirador * 0.75}
                  y1={-radioTirador * 0.75}
                  x2={0}
                  y2={0}
                  stroke="#d8ceff"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
                <circle r={9} fill="#d8ceff" stroke="#141422" strokeWidth={3} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Círculo pequeño en la esquina de la mesa, siempre derecho aunque la mesa esté girada. */
function Insignia({
  x,
  y,
  rotacion,
  color,
  children,
}: Readonly<{ x: number; y: number; rotacion: number; color: string; children: React.ReactNode }>) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${-rotacion})`} style={{ pointerEvents: 'none' }}>
      <circle r={11} fill={color} stroke="#141422" strokeWidth={2.5} />
      {children}
    </g>
  );
}

const NIVELES_DE_ZOOM = [1, 1.5, 2, 3];

interface PropsVisor {
  ancho: number;
  alto: number;
  /** Dibuja el plano con la escala que le toca. */
  children: (escala: number) => React.ReactNode;
  /** Se muestra bajo el plano, por ejemplo la leyenda de colores. */
  pie?: React.ReactNode;
}

/**
 * Marco del plano: por defecto lo ajusta al ancho de la pantalla; se puede acercar y desplazar, o
 * abrir a pantalla completa (en el teléfono, ojalá en horizontal).
 */
export function VisorPlano({ ancho, alto, children, pie }: Readonly<PropsVisor>) {
  const { ref, width, height } = useElementSize();
  const [zoom, setZoom] = useState(0);
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    if (!completa) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Si el navegador entra a pantalla completa de verdad y la persona sale con «atrás» o Esc, se
    // cierra también el modo del plano.
    const alSalir = () => {
      if (!document.fullscreenElement) setCompleta(false);
    };
    document.addEventListener('fullscreenchange', alSalir);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener('fullscreenchange', alSalir);
    };
  }, [completa]);

  const alternarCompleta = () => {
    if (completa) {
      screen.orientation?.unlock?.();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      setCompleta(false);
      return;
    }
    setCompleta(true);
    // iPhone no tiene pantalla completa para páginas: ahí basta el modo del plano. En Android, ya a
    // pantalla completa, un plano más ancho que alto se ve mejor con el teléfono horizontal.
    void document.documentElement
      .requestFullscreen?.()
      .then(() => {
        const orientacion = screen.orientation as ScreenOrientation & {
          lock?: (orientacion: string) => Promise<void>;
        };
        if (ancho > alto) return orientacion.lock?.('landscape');
      })
      .catch(() => {});
  };

  const base = escalaParaAjustar(
    { ancho, alto },
    { ancho: width, alto: completa ? height : undefined },
  );
  const escala = base * (NIVELES_DE_ZOOM[zoom] ?? 1);
  const vertical = height > width;

  const controles = (
    <Group gap={6} wrap="nowrap">
      <Control
        etiqueta="Alejar"
        disabled={zoom === 0}
        onClick={() => setZoom((z) => Math.max(0, z - 1))}
      >
        <IconZoomOut size={20} />
      </Control>
      <Control
        etiqueta="Acercar"
        disabled={zoom === NIVELES_DE_ZOOM.length - 1}
        onClick={() => setZoom((z) => Math.min(NIVELES_DE_ZOOM.length - 1, z + 1))}
      >
        <IconZoomIn size={20} />
      </Control>
      <Control etiqueta="Ajustar a la pantalla" disabled={zoom === 0} onClick={() => setZoom(0)}>
        <IconZoomReset size={20} />
      </Control>
      <Control
        etiqueta={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
        onClick={alternarCompleta}
      >
        {completa ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
      </Control>
    </Group>
  );

  return (
    <Box
      style={
        completa
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 300,
              background: 'var(--mantine-color-dark-8)',
              display: 'flex',
              flexDirection: 'column',
              padding: 12,
              gap: 8,
            }
          : { display: 'flex', flexDirection: 'column', gap: 8 }
      }
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed">
          {completa && vertical && ancho > alto
            ? 'Gira el teléfono para verlo más grande'
            : zoom === 0
              ? 'Plano ajustado a la pantalla'
              : `Acercado ×${NIVELES_DE_ZOOM[zoom]}`}
        </Text>
        {controles}
      </Group>
      <Box
        ref={ref}
        style={{
          flex: completa ? 1 : undefined,
          minHeight: 0,
          overflow: 'auto',
          borderRadius: 'var(--mantine-radius-lg)',
          background: 'var(--mantine-color-dark-8)',
          border: '1px solid var(--mantine-color-dark-5)',
        }}
      >
        {width > 0 && (
          <Box style={{ width: 'max-content', margin: '0 auto' }}>{children(escala)}</Box>
        )}
      </Box>
      {pie}
    </Box>
  );
}

function Control({
  etiqueta,
  disabled,
  onClick,
  children,
}: Readonly<{
  etiqueta: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>) {
  return (
    <ActionIcon
      size={40}
      variant="default"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </ActionIcon>
  );
}

/** Leyenda de colores bajo el plano del garzón. */
export function LeyendaPlano() {
  const items: [string, string][] = [
    ['Libre', '#3f3f5c'],
    ['Ocupada', '#8462ff'],
    ['Lista para retirar', '#2fbf71'],
    ['Espera de +10 min', '#f59f0b'],
  ];
  return (
    <Group gap="md" justify="center">
      {items.map(([texto, color]) => (
        <Group key={texto} gap={6} wrap="nowrap">
          <Box w={10} h={10} style={{ borderRadius: '50%', background: color }} />
          <Text size="xs" c="dimmed">
            {texto}
          </Text>
        </Group>
      ))}
    </Group>
  );
}
