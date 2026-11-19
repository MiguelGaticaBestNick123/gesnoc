'use client';

import {
  ActionIcon,
  Box,
  Drawer,
  Group,
  Indicator,
  NativeSelect,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconMessages, IconSend } from '@tabler/icons-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { nombreDelRol } from '@/modules/noche/nombres';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson, nuevaClaveDeEnvio } from '@/shared/red';
import { nombreDelCanal, noLeidos, type Canal } from './canales';
import type { EstadoDelChat } from './servicios/chat';

const VACIO: EstadoDelChat = { noche: null, canales: [], mensajes: [], yo: 0 };

const claveDeVistos = (noche: string, yo: number) => `gesnoc:chat:${noche}:${yo}`;

/** Hasta qué mensaje vio la persona en cada canal: se guarda en el teléfono, por noche. */
function useVistos(noche: string | null, yo: number) {
  const [vistos, setVistos] = useState<Partial<Record<Canal, number>>>({});
  useEffect(() => {
    if (!noche) return;
    try {
      const guardado = window.localStorage.getItem(claveDeVistos(noche, yo));
      // Al cambiar de noche o de persona se parte de lo que quedó guardado en este teléfono.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVistos(guardado ? (JSON.parse(guardado) as Partial<Record<Canal, number>>) : {});
    } catch {
      setVistos({});
    }
  }, [noche, yo]);
  const marcar = (canal: Canal, numero: number) => {
    if (!noche || (vistos[canal] ?? 0) >= numero) return;
    const nuevos = { ...vistos, [canal]: numero };
    setVistos(nuevos);
    try {
      window.localStorage.setItem(claveDeVistos(noche, yo), JSON.stringify(nuevos));
    } catch {
      // Sin almacenamiento local, los avisos de no leídos se reinician al recargar.
    }
  };
  return { vistos, marcar };
}

const puestoDe = (puesto: string | null) =>
  puesto === 'admin' ? 'Administración' : puesto ? (nombreDelRol[puesto] ?? puesto) : null;

/**
 * Chat del personal (pedido del Product Owner, 18 nov): el botón de arriba a la derecha abre el
 * panel; arriba se elige el canal, el general o el del rol, y abajo se escribe. Llega cada 3 s.
 */
export function BotonChat() {
  const { datos, actualizar } = useTiempoReal<EstadoDelChat>('/api/vivo/chat', VACIO);
  const [abierto, { open, close }] = useDisclosure(false);
  const angosto = useMediaQuery('(max-width: 36em)');
  const [elegido, setElegido] = useState<Canal>('general');
  const [texto, setTexto] = useState('');
  const [clave, setClave] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { vistos, marcar } = useVistos(datos.noche, datos.yo);
  const fondo = useRef<HTMLDivElement>(null);

  const canal = datos.canales.includes(elegido) ? elegido : (datos.canales[0] ?? 'general');
  const delCanal = datos.mensajes.filter((mensaje) => mensaje.canal === canal);
  const ultimo = delCanal.at(-1)?.numero ?? 0;
  const pendientes = noLeidos(datos.mensajes, vistos, datos.yo);
  const total = Object.values(pendientes).reduce((suma, n) => suma + (n ?? 0), 0);

  // Con el panel abierto, lo que se ve queda leído y la lista baja al último mensaje.
  const alVerElCanal = useEffectEvent(() => {
    marcar(canal, ultimo);
    fondo.current?.scrollIntoView({ block: 'end' });
  });
  useEffect(() => {
    if (abierto) alVerElCanal();
  }, [abierto, canal, ultimo]);

  if (datos.canales.length === 0) return null;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!texto.trim() || enviando) return;
    // La misma clave en un reintento: si el primer envío llegó, no se duplica (RN-13).
    const claveEnvio = clave ?? nuevaClaveDeEnvio();
    setClave(claveEnvio);
    setEnviando(true);
    setError(null);
    const respuesta = await enviarJson('/api/chat', { canal, texto, claveEnvio });
    setEnviando(false);
    if (respuesta.ok) {
      setTexto('');
      setClave(null);
      await actualizar();
      return;
    }
    setError(respuesta.error);
    if (!respuesta.incierto) setClave(null);
  }

  const etiqueta = (c: Canal) =>
    pendientes[c] ? `${nombreDelCanal[c]} (${pendientes[c]})` : nombreDelCanal[c];
  const opciones = datos.canales.map((c) => ({ value: c, label: etiqueta(c) }));

  return (
    <>
      <Indicator label={total} disabled={total === 0} size={18} color="red" offset={8}>
        <ActionIcon
          size={44}
          variant="subtle"
          color="gray"
          onClick={open}
          aria-label={total > 0 ? `Chat del personal: ${total} sin leer` : 'Chat del personal'}
        >
          <IconMessages size={21} />
        </ActionIcon>
      </Indicator>

      <Drawer
        opened={abierto}
        onClose={close}
        position="right"
        size={angosto ? '100%' : 'md'}
        title="Chat del personal"
        styles={{
          content: { display: 'flex', flexDirection: 'column' },
          body: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingTop: 0 },
        }}
      >
        <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
          {datos.canales.length <= 2 ? (
            <SegmentedControl
              fullWidth
              value={canal}
              onChange={(valor) => setElegido(valor as Canal)}
              data={opciones}
              aria-label="Canal"
            />
          ) : (
            <NativeSelect
              label="Canal"
              value={canal}
              onChange={(evento) => setElegido(evento.currentTarget.value as Canal)}
              data={opciones}
            />
          )}

          <ScrollArea style={{ flex: 1 }} type="auto">
            <Stack gap="xs" py="xs" role="log" aria-label={`Mensajes de ${nombreDelCanal[canal]}`}>
              {delCanal.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  Todavía no hay mensajes en {nombreDelCanal[canal]}.
                </Text>
              )}
              {delCanal.map((mensaje) => {
                const propio = mensaje.autorId === datos.yo;
                const puesto = puestoDe(mensaje.puesto);
                return (
                  <Box
                    key={mensaje.numero}
                    px="sm"
                    py={8}
                    style={{
                      alignSelf: propio ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      borderRadius: 'var(--mantine-radius-lg)',
                      background: propio
                        ? 'var(--mantine-color-violeta-8)'
                        : 'var(--mantine-color-dark-5)',
                    }}
                  >
                    {!propio && (
                      <Text size="xs" fw={700} c="gray.2">
                        {mensaje.autor}
                        {puesto && ` · ${puesto}`}
                      </Text>
                    )}
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {mensaje.texto}
                    </Text>
                    <Text size="xs" ta="right" c={propio ? 'violeta.1' : 'gray.4'}>
                      {mensaje.hora}
                    </Text>
                  </Box>
                );
              })}
              <div ref={fondo} />
            </Stack>
          </ScrollArea>

          <form onSubmit={enviar}>
            <Group align="flex-end" gap="xs" wrap="nowrap">
              <Textarea
                aria-label={`Mensaje para ${nombreDelCanal[canal]}`}
                placeholder={`Escribe a ${nombreDelCanal[canal]}`}
                value={texto}
                onChange={(evento) => setTexto(evento.currentTarget.value)}
                autosize
                minRows={1}
                maxRows={4}
                maxLength={500}
                style={{ flex: 1 }}
                styles={{ input: { minHeight: 44 } }}
              />
              <ActionIcon
                type="submit"
                size={44}
                loading={enviando}
                disabled={!texto.trim()}
                aria-label="Enviar mensaje"
              >
                <IconSend size={20} />
              </ActionIcon>
            </Group>
            {error && (
              <Text c="red.4" size="sm" role="alert" mt={4}>
                {error}
              </Text>
            )}
          </form>
        </Stack>
      </Drawer>
    </>
  );
}
