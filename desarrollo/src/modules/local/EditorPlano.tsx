'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Grid,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconArrowBackUp,
  IconDeviceFloppy,
  IconMap2,
  IconPlus,
  IconRotate,
  IconRotateClockwise,
  IconTrash,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { mensajeDeFalla } from '@/shared/red';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { guardarPlano } from './acciones';
import {
  cambiarForma,
  lugarLibre,
  mover,
  numerosRepetidos,
  PASO,
  redimensionar,
  siguienteNumero,
  sillasSegunTamano,
  type FormaMesa,
  type Mesa,
} from './geometria';
import { PlanoMesas, VisorPlano, type MesaDibujada } from './PlanoMesas';
import type { PlanoParaEditar } from './servicios/mapa';

type MesaEditable = Mesa & { nueva?: boolean };
type Ambiente = NonNullable<PlanoParaEditar['ambiente']>;

const formas: { value: FormaMesa; label: string }[] = [
  { value: 'cuadrada', label: 'Cuadrada' },
  { value: 'redonda', label: 'Redonda' },
  { value: 'rectangular', label: 'Rectangular' },
];

const flechas: Record<string, [number, number]> = {
  ArrowLeft: [-PASO, 0],
  ArrowRight: [PASO, 0],
  ArrowUp: [0, -PASO],
  ArrowDown: [0, PASO],
};

const numero = (valor: string | number) => (typeof valor === 'number' ? valor : Number(valor));

// HU-05: la administración dibuja el plano de cada ambiente. Los cambios quedan en el teléfono o el
// computador hasta «Guardar plano», que los aplica todos juntos en una transacción.
export function EditorPlano({
  inicial,
  ambiente,
}: Readonly<{ inicial: PlanoParaEditar; ambiente: Ambiente }>) {
  const router = useRouter();
  const plano = { ancho: ambiente.planoAncho, alto: ambiente.planoAlto };
  const [guardadas, setGuardadas] = useState<MesaEditable[]>(inicial.mesas);
  const [mesas, setMesas] = useState<MesaEditable[]>(inicial.mesas);
  const [retiradas, setRetiradas] = useState<number[]>([]);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [proximoId, setProximoId] = useState(-1);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const hayCambios = retiradas.length > 0 || JSON.stringify(mesas) !== JSON.stringify(guardadas);
  const repetidos = numerosRepetidos(mesas);
  const elegida = mesas.find((mesa) => mesa.id === seleccionada);
  const conCuenta = (id: number) => inicial.conCuenta.includes(id);

  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);

  const cambiar = (id: number, cambio: (mesa: MesaEditable) => MesaEditable) => {
    setMesas((actuales) => actuales.map((mesa) => (mesa.id === id ? cambio(mesa) : mesa)));
    setMensaje(null);
  };

  // Con una mesa elegida, las flechas del teclado la mueven de a 10.
  const alTeclear = useEffectEvent((evento: KeyboardEvent) => {
    const paso = flechas[evento.key];
    const destino = evento.target as HTMLElement;
    if (!paso || seleccionada === null || destino.closest('input, textarea')) return;
    evento.preventDefault();
    cambiar(seleccionada, (m) => mover(m, m.posX + paso[0], m.posY + paso[1], plano));
  });
  useEffect(() => {
    const manejar = (evento: KeyboardEvent) => alTeclear(evento);
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, []);

  function agregar() {
    const id = proximoId;
    const lugar = lugarLibre(mesas, plano, 80, 80);
    const nueva: MesaEditable = {
      id,
      numero: siguienteNumero(mesas),
      forma: 'cuadrada',
      ancho: 80,
      alto: 80,
      rotacion: 0,
      sillas: null,
      nueva: true,
      ...lugar,
    };
    setMesas((actuales) => [...actuales, nueva]);
    setProximoId(id - 1);
    setSeleccionada(id);
    setMensaje(null);
  }

  function retirar(mesa: MesaEditable) {
    setMesas((actuales) => actuales.filter((m) => m.id !== mesa.id));
    if (!mesa.nueva) setRetiradas((actuales) => [...actuales, mesa.id]);
    setSeleccionada(null);
    setMensaje(null);
  }

  function descartar() {
    setMesas(guardadas);
    setRetiradas([]);
    setSeleccionada(null);
    setMensaje(null);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const resultado = await guardarPlano({
        ambienteId: ambiente.id,
        mesas: mesas.map(({ nueva, id, ...mesa }) => (nueva ? mesa : { id, ...mesa })),
        retiradas,
      });
      if (resultado.error || !resultado.mesas) {
        setMensaje({ ok: false, texto: resultado.error ?? 'No se pudo guardar el plano' });
        return;
      }
      setGuardadas(resultado.mesas);
      setMesas(resultado.mesas);
      setRetiradas([]);
      setSeleccionada(null);
      setMensaje({ ok: true, texto: 'Plano guardado: los garzones ya lo ven así.' });
    } catch (error) {
      setMensaje({ ok: false, texto: mensajeDeFalla(error) });
    } finally {
      setGuardando(false);
    }
  }

  function cambiarAmbiente(id: string) {
    if (hayCambios && !window.confirm('Hay cambios sin guardar en este plano. ¿Descartarlos?')) {
      return;
    }
    router.push(`/admin/mapa?ambiente=${id}`);
  }

  const dibujadas: MesaDibujada[] = mesas.map((mesa) => ({
    ...mesa,
    estado: repetidos.includes(mesa.numero) ? 'invalida' : 'neutra',
    etiqueta: `Mesa ${mesa.numero}`,
  }));

  return (
    <Stack gap="md">
      <EncabezadoPagina
        icono={IconMap2}
        titulo="Mapa de mesas"
        descripcion={`${ambiente.nombre} · ${mesas.length} mesas · arrastra para mover, toca para editar`}
      />

      {inicial.ambientes.length > 1 && (
        <SegmentedControl
          value={String(ambiente.id)}
          onChange={cambiarAmbiente}
          data={inicial.ambientes.map((a) => ({ value: String(a.id), label: a.nombre }))}
        />
      )}

      <Group gap="xs">
        <Button size="md" variant="light" leftSection={<IconPlus size={18} />} onClick={agregar}>
          Agregar mesa
        </Button>
        <Button
          size="md"
          variant="default"
          leftSection={<IconArrowBackUp size={18} />}
          onClick={descartar}
          disabled={!hayCambios || guardando}
        >
          Descartar cambios
        </Button>
        <Button
          size="md"
          leftSection={<IconDeviceFloppy size={18} />}
          onClick={() => void guardar()}
          loading={guardando}
          disabled={!hayCambios || repetidos.length > 0}
        >
          Guardar plano
        </Button>
      </Group>

      {mensaje && (
        <Alert
          color={mensaje.ok ? 'green' : 'red'}
          variant="light"
          role={mensaje.ok ? 'status' : 'alert'}
        >
          {mensaje.texto}
        </Alert>
      )}
      {repetidos.length > 0 && (
        <Alert color="red" variant="light">
          Hay mesas con el mismo número ({repetidos.join(', ')}): cámbialo antes de guardar.
        </Alert>
      )}

      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <VisorPlano ancho={plano.ancho} alto={plano.alto}>
            {(escala) => (
              <PlanoMesas
                ancho={plano.ancho}
                alto={plano.alto}
                mesas={dibujadas}
                escala={escala}
                seleccionada={seleccionada}
                alElegir={setSeleccionada}
                edicion={{
                  alMover: (id, x, y) => cambiar(id, (m) => mover(m, x, y, plano)),
                  alRedimensionar: (id, ancho, alto) =>
                    cambiar(id, (m) => mover(redimensionar(m, ancho, alto), m.posX, m.posY, plano)),
                }}
              />
            )}
          </VisorPlano>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md" aria-label="Mesa elegida" component="section">
            {elegida ? (
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700} size="lg">
                    Mesa {elegida.numero}
                  </Text>
                  {elegida.nueva && <Badge>Nueva</Badge>}
                  {conCuenta(elegida.id) && <Badge color="violeta">Con cuenta abierta</Badge>}
                </Group>
                <NumberInput
                  key={elegida.id}
                  label="Número"
                  defaultValue={elegida.numero}
                  min={1}
                  max={999}
                  allowDecimal={false}
                  error={
                    repetidos.includes(elegida.numero) ? 'Otra mesa tiene este número' : undefined
                  }
                  onChange={(valor) => {
                    const nuevo = numero(valor);
                    if (Number.isInteger(nuevo) && nuevo >= 1 && nuevo <= 999) {
                      cambiar(elegida.id, (m) => ({ ...m, numero: nuevo }));
                    }
                  }}
                />
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    Forma
                  </Text>
                  <SegmentedControl
                    fullWidth
                    data={formas}
                    value={elegida.forma}
                    onChange={(forma) =>
                      cambiar(elegida.id, (m) =>
                        mover(cambiarForma(m, forma as FormaMesa), m.posX, m.posY, plano),
                      )
                    }
                  />
                </div>
                <SimpleGrid cols={2} spacing="xs">
                  <NumberInput
                    key={`${elegida.id}-${elegida.ancho}-${elegida.alto}`}
                    label="Ancho"
                    defaultValue={elegida.ancho}
                    step={PASO}
                    min={20}
                    max={400}
                    allowDecimal={false}
                    onBlur={(evento) => {
                      const ancho = numero(evento.currentTarget.value);
                      if (!Number.isFinite(ancho)) return;
                      cambiar(elegida.id, (m) =>
                        mover(
                          redimensionar(m, ancho, m.forma === 'rectangular' ? m.alto : ancho),
                          m.posX,
                          m.posY,
                          plano,
                        ),
                      );
                    }}
                  />
                  <NumberInput
                    key={`${elegida.id}-${elegida.alto}-${elegida.ancho}`}
                    label="Alto"
                    defaultValue={elegida.alto}
                    step={PASO}
                    min={20}
                    max={400}
                    allowDecimal={false}
                    disabled={elegida.forma !== 'rectangular'}
                    onBlur={(evento) => {
                      const alto = numero(evento.currentTarget.value);
                      if (!Number.isFinite(alto)) return;
                      cambiar(elegida.id, (m) =>
                        mover(redimensionar(m, m.ancho, alto), m.posX, m.posY, plano),
                      );
                    }}
                  />
                </SimpleGrid>
                <NumberInput
                  key={`${elegida.id}-sillas-${elegida.sillas ?? 'auto'}`}
                  label="Sillas"
                  description="Vacío: las que caben según el tamaño"
                  placeholder={`${sillasSegunTamano(elegida)} según el tamaño`}
                  defaultValue={elegida.sillas ?? ''}
                  min={0}
                  max={20}
                  allowDecimal={false}
                  onBlur={(evento) => {
                    const texto = evento.currentTarget.value.trim();
                    if (texto === '') {
                      cambiar(elegida.id, (m) => ({ ...m, sillas: null }));
                      return;
                    }
                    const sillas = numero(texto);
                    if (Number.isInteger(sillas) && sillas >= 0 && sillas <= 20) {
                      cambiar(elegida.id, (m) => ({ ...m, sillas }));
                    }
                  }}
                />
                <Group justify="space-between">
                  <Text size="sm">Rotación: {elegida.rotacion}°</Text>
                  <Group gap="xs">
                    <ActionIcon
                      size={44}
                      variant="default"
                      aria-label="Girar a la izquierda"
                      onClick={() =>
                        cambiar(elegida.id, (m) => ({ ...m, rotacion: (m.rotacion + 345) % 360 }))
                      }
                    >
                      <IconRotate size={20} />
                    </ActionIcon>
                    <ActionIcon
                      size={44}
                      variant="default"
                      aria-label="Girar a la derecha"
                      onClick={() =>
                        cambiar(elegida.id, (m) => ({ ...m, rotacion: (m.rotacion + 15) % 360 }))
                      }
                    >
                      <IconRotateClockwise size={20} />
                    </ActionIcon>
                  </Group>
                </Group>
                <Button
                  size="md"
                  color="red"
                  variant="light"
                  leftSection={<IconTrash size={18} />}
                  disabled={conCuenta(elegida.id)}
                  onClick={() => retirar(elegida)}
                >
                  {elegida.nueva ? 'Quitar mesa' : 'Retirar mesa'}
                </Button>
                {conCuenta(elegida.id) ? (
                  <Text size="xs" c="dimmed">
                    Tiene una cuenta abierta: se puede retirar después de cobrarla.
                  </Text>
                ) : (
                  !elegida.nueva && (
                    <Text size="xs" c="dimmed">
                      Retirarla libera su número; sus cuentas pasadas no cambian (CA3).
                    </Text>
                  )
                )}
              </Stack>
            ) : (
              <Stack gap={6}>
                <Text fw={600}>Ninguna mesa elegida</Text>
                <Text size="sm" c="dimmed">
                  Toca una mesa para cambiar su número, forma, tamaño o giro, o arrástrala para
                  moverla. El círculo de la esquina cambia su tamaño. Con el teclado, las flechas la
                  mueven de a 10.
                </Text>
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
