'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconDoorEnter,
  IconListDetails,
  IconSearch,
  IconStar,
  IconTicket,
  IconWifiOff,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTiempoReal } from '@/shared/puertos/tiempo-real';
import { enviarJson } from '@/shared/red';
import { AvisoConexion } from '@/shared/ui/AvisoConexion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora, tituloDeFecha } from '@/shared/utilidades/fechas';
import { formatearDocumento, normalizarRut, type TipoDocumento } from '@/shared/utilidades/rut';
import { FORMAS_DE_ENTRADA, formas, type FormaDeEntrada } from './formas';
import { ListaDeIngresos, TarjetaIngresos } from './Ingresos';
import type { Busqueda, IngresoRegistrado, IngresosDeLaNoche } from './servicios/puerta';

interface Envio {
  tipoDocumento: TipoDocumento;
  documento: string;
  nombre?: string;
  apellido?: string;
  forma: FormaDeEntrada;
  monto: number;
}

type Paso =
  | { tipo: 'documento' }
  | { tipo: 'persona'; busqueda: Busqueda }
  | { tipo: 'registrando'; busqueda: Busqueda; forma: FormaDeEntrada }
  | { tipo: 'incierto'; busqueda: Busqueda; envio: Envio; error: string }
  | { tipo: 'listo'; ingreso: IngresoRegistrado };

const iniciales = (nombre: string, apellido: string) =>
  `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

/** Lo que dice la lista o la invitación de la persona, para que el guardia la deje pasar bien. */
function AvisoInvitacion({
  invitacion,
}: Readonly<{ invitacion: NonNullable<Busqueda['invitacion']> }>) {
  const origen = invitacion.lista
    ? `Viene en la lista «${invitacion.lista}», de ${invitacion.responsable}`
    : `Invitado por ${invitacion.invitadoPor}`;
  return (
    <Alert
      color={invitacion.gratis ? 'green' : 'violeta'}
      variant="light"
      icon={invitacion.lista ? <IconListDetails size={20} /> : <IconStar size={20} />}
      title={invitacion.gratis ? 'Entra gratis' : 'Paga su entrada'}
    >
      {origen}.
    </Alert>
  );
}

/** Los cuatro botones de la puerta: EF, RC, PN y gratis, grandes y sin ninguno preseleccionado. */
function BotonesDeEntrada({
  precio,
  sugerida,
  enviando,
  alElegir,
}: Readonly<{
  precio: number;
  sugerida: FormaDeEntrada | null;
  enviando: FormaDeEntrada | null;
  alElegir: (forma: FormaDeEntrada) => void;
}>) {
  const disponibles = precio === 0 ? (['gratis'] as const) : FORMAS_DE_ENTRADA;
  return (
    <Stack gap={6}>
      <Text size="sm" c="dimmed">
        {precio === 0
          ? 'Esta noche la entrada es gratis.'
          : `Entrada ${formatearPesos(precio)}: ¿cómo entra?`}
      </Text>
      <SimpleGrid cols={disponibles.length === 1 ? 1 : 2} spacing="sm">
        {disponibles.map((forma) => {
          const datos = formas[forma];
          const monto = forma === 'gratis' ? 'sin ticket' : formatearPesos(precio);
          return (
            <Button
              key={forma}
              color={datos.color}
              variant={sugerida === forma ? 'filled' : 'light'}
              h={76}
              radius="lg"
              loading={enviando === forma}
              disabled={enviando !== null && enviando !== forma}
              onClick={() => alElegir(forma)}
              aria-label={
                forma === 'gratis'
                  ? 'Gratis, sin ticket'
                  : `${datos.codigo}, ${datos.nombre.toLowerCase()}, ${monto}`
              }
              styles={{ label: { flexDirection: 'column', gap: 2 } }}
            >
              <Text component="span" fw={800} fz={24} lh={1}>
                {datos.codigo}
              </Text>
              <Text component="span" size="xs" fw={500} lh={1.2}>
                {forma === 'gratis' ? 'Sin ticket' : datos.nombre}
              </Text>
            </Button>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

// La puerta (HU-30, HU-32 y HU-33, como las pidió el Product Owner el 12 nov): documento, buscar y
// un toque para registrar la entrada como EF, RC, PN o gratis. El guardia ve quién entró, con hora,
// ticket, nombre, RUT y forma, pero no lo recaudado: eso es de la administración.
export function Puerta({ inicial }: Readonly<{ inicial: IngresosDeLaNoche }>) {
  const { datos, sinConexion, actualizar } = useTiempoReal('/api/vivo/puerta', inicial);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('rut');
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [paso, setPaso] = useState<Paso>({ tipo: 'documento' });
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const reiniciar = () => {
    setDocumento('');
    setNombre('');
    setApellido('');
    setError(null);
    setPaso({ tipo: 'documento' });
    campo.current?.focus();
  };

  async function buscar() {
    if (!documento.trim() || buscando) return;
    setError(null);
    setBuscando(true);
    const respuesta = await enviarJson<Busqueda>('/api/puerta/buscar', {
      tipoDocumento,
      documento,
    });
    setBuscando(false);
    if (!respuesta.ok) {
      setError(respuesta.error);
      setPaso({ tipo: 'documento' });
      return;
    }
    const busqueda = respuesta.datos;
    // Quien viene en una lista ya trae su nombre: en la puerta no se escribe.
    setNombre(busqueda.cliente?.nombre ?? busqueda.invitacion?.nombre ?? '');
    setApellido(busqueda.cliente?.apellido ?? busqueda.invitacion?.apellido ?? '');
    setPaso({ tipo: 'persona', busqueda });
  }

  async function enviar(busqueda: Busqueda, envio: Envio) {
    setError(null);
    setPaso({ tipo: 'registrando', busqueda, forma: envio.forma });
    const respuesta = await enviarJson<IngresoRegistrado>('/api/puerta/entradas', envio);
    if (respuesta.ok) {
      setPaso({ tipo: 'listo', ingreso: respuesta.datos });
      void actualizar();
      return;
    }
    if (respuesta.incierto) {
      // No se sabe si quedó: reintentar es seguro, porque la persona entra una sola vez (RN-21).
      setPaso({ tipo: 'incierto', busqueda, envio, error: respuesta.error });
      return;
    }
    setError(respuesta.error);
    setPaso({ tipo: 'persona', busqueda });
  }

  const registrar = (busqueda: Busqueda, forma: FormaDeEntrada) =>
    enviar(busqueda, {
      tipoDocumento,
      documento,
      ...(busqueda.cliente ? {} : { nombre, apellido }),
      forma,
      monto: forma === 'gratis' ? 0 : busqueda.precio,
    });

  // Un pasaporte de solo números puede parecer un RUT: se avisa para no duplicar a la persona.
  const pareceRut = tipoDocumento === 'extranjero' && normalizarRut(documento) !== null;
  const busqueda =
    paso.tipo === 'persona' || paso.tipo === 'registrando' || paso.tipo === 'incierto'
      ? paso.busqueda
      : null;

  if (!datos.noche) {
    return (
      <Stack gap="md">
        <EncabezadoPagina icono={IconDoorEnter} titulo="Entrada" />
        <Alert color="gray" variant="light">
          No hay una noche abierta. La puerta se habilita cuando la administración abre la noche.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <EncabezadoPagina
        icono={IconDoorEnter}
        titulo="Entrada"
        descripcion={`${tituloDeFecha(datos.noche)} · Entrada ${formatearPesos(datos.precio)}`}
      />
      <AvisoConexion sinConexion={sinConexion} />

      {paso.tipo === 'listo' ? (
        <Card withBorder padding="lg" ta="center" role="status" aria-live="polite">
          <Stack gap="xs" align="center">
            {paso.ingreso.repetida && (
              <Badge color="yellow" variant="light" size="lg" tt="none">
                Ya estaba registrada a las {formatearHora(paso.ingreso.registradaEn)}
              </Badge>
            )}
            {paso.ingreso.ticket !== null ? (
              <>
                <Group gap={6} c="dimmed">
                  <IconTicket size={20} />
                  <Text size="sm" fw={600} tt="uppercase">
                    Ticket
                  </Text>
                </Group>
                <Text
                  fw={800}
                  fz={72}
                  lh={1}
                  c="violeta.3"
                  aria-label={`Ticket ${paso.ingreso.ticket}`}
                >
                  {paso.ingreso.ticket}
                </Text>
              </>
            ) : (
              <Text fw={800} fz={32} lh={1.1}>
                Entrada gratis
              </Text>
            )}
            <Text fw={700} size="lg">
              {paso.ingreso.nombre} {paso.ingreso.apellido}
            </Text>
            <Group gap="xs" justify="center">
              <Badge color={formas[paso.ingreso.forma].color} size="lg" tt="none">
                {formas[paso.ingreso.forma].codigo}
              </Badge>
              <Text size="sm" c="dimmed">
                {formatearDocumento(paso.ingreso.documento)} ·{' '}
                {formatearHora(paso.ingreso.registradaEn)}
              </Text>
            </Group>
            <Button mt="sm" fullWidth onClick={reiniciar} data-autofocus>
              Siguiente persona
            </Button>
          </Stack>
        </Card>
      ) : (
        <Card withBorder padding="md">
          <Stack gap="sm">
            <SegmentedControl
              value={tipoDocumento}
              onChange={(valor) => {
                setTipoDocumento(valor as TipoDocumento);
                setPaso({ tipo: 'documento' });
              }}
              aria-label="Tipo de documento"
              fullWidth
              data={[
                { value: 'rut', label: 'RUT' },
                { value: 'extranjero', label: 'Extranjero' },
              ]}
            />
            <form
              onSubmit={(evento) => {
                evento.preventDefault();
                void buscar();
              }}
            >
              <Stack gap="xs">
                <TextInput
                  ref={campo}
                  label="Documento"
                  placeholder={tipoDocumento === 'rut' ? '12.345.678-5' : 'Letras y números'}
                  value={documento}
                  onChange={(evento) => {
                    setDocumento(evento.currentTarget.value);
                    if (paso.tipo !== 'documento') setPaso({ tipo: 'documento' });
                  }}
                  inputMode={tipoDocumento === 'rut' ? 'numeric' : 'text'}
                  autoComplete="off"
                  size="lg"
                  styles={{ input: { fontSize: 24, fontWeight: 700, letterSpacing: 1 } }}
                  rightSectionWidth={52}
                  rightSection={
                    tipoDocumento === 'rut' && (
                      <ActionIcon
                        variant="light"
                        size={40}
                        onClick={() => {
                          setDocumento((actual) => `${actual}K`);
                          campo.current?.focus();
                        }}
                        aria-label="Agregar K"
                      >
                        <Text fw={800}>K</Text>
                      </ActionIcon>
                    )
                  }
                />
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={buscando}
                  leftSection={<IconSearch size={20} />}
                >
                  Buscar
                </Button>
              </Stack>
            </form>
            {pareceRut && (
              <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={20} />}>
                Esto parece un RUT. Si la persona es chilena, elige RUT para no registrarla dos
                veces.
              </Alert>
            )}
            {error && (
              <Alert color="red" variant="light" role="alert">
                {error}
              </Alert>
            )}

            {busqueda?.entrada && (
              <Alert
                color="red"
                variant="light"
                icon={<IconAlertTriangle size={20} />}
                title="Ya entró esta noche"
                role="alert"
              >
                {`${busqueda.cliente?.nombre} ${busqueda.cliente?.apellido} entró a las ${formatearHora(busqueda.entrada.registradaEn)}`}
                {busqueda.entrada.ticket !== null && ` con el ticket ${busqueda.entrada.ticket}`}
                {` (${formas[busqueda.entrada.forma].codigo}). Una persona entra una sola vez por noche.`}
                <Button mt="sm" variant="default" fullWidth onClick={reiniciar}>
                  Siguiente persona
                </Button>
              </Alert>
            )}

            {busqueda && !busqueda.entrada && (
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <Avatar size={48} radius="xl" color="violeta" variant="light">
                    {busqueda.cliente || busqueda.invitacion ? iniciales(nombre, apellido) : '?'}
                  </Avatar>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} size="lg" truncate>
                      {busqueda.cliente || busqueda.invitacion
                        ? `${nombre} ${apellido}`
                        : 'Persona nueva'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatearDocumento(busqueda.documento)}
                      {busqueda.cliente && busqueda.cliente.visitas > 0
                        ? ` · vino ${busqueda.cliente.visitas} ${busqueda.cliente.visitas === 1 ? 'vez' : 'veces'}`
                        : ' · primera vez que viene'}
                    </Text>
                  </div>
                </Group>
                {busqueda.invitacion && <AvisoInvitacion invitacion={busqueda.invitacion} />}
                {!busqueda.cliente && (
                  <Group grow>
                    <TextInput
                      label="Nombre"
                      value={nombre}
                      onChange={(evento) => setNombre(evento.currentTarget.value)}
                      size="md"
                      autoComplete="off"
                    />
                    <TextInput
                      label="Apellido"
                      value={apellido}
                      onChange={(evento) => setApellido(evento.currentTarget.value)}
                      size="md"
                      autoComplete="off"
                    />
                  </Group>
                )}
                {paso.tipo === 'incierto' ? (
                  <Alert
                    color="yellow"
                    variant="light"
                    icon={<IconWifiOff size={20} />}
                    role="alert"
                  >
                    {paso.error} Reintentar es seguro: la persona entra una sola vez.
                    <Button
                      mt="sm"
                      fullWidth
                      color="yellow"
                      onClick={() => void enviar(paso.busqueda, paso.envio)}
                    >
                      Reintentar
                    </Button>
                  </Alert>
                ) : (
                  <BotonesDeEntrada
                    precio={busqueda.precio}
                    sugerida={busqueda.invitacion?.gratis ? 'gratis' : null}
                    enviando={paso.tipo === 'registrando' ? paso.forma : null}
                    alElegir={(forma) => void registrar(busqueda, forma)}
                  />
                )}
                <UnstyledButton onClick={reiniciar} c="dimmed" fz="sm" ta="center" mih={44}>
                  Cancelar
                </UnstyledButton>
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      <TarjetaIngresos datos={datos}>
        <ListaDeIngresos ingresos={datos.ingresos} limite={8} />
        {datos.ingresos.length > 8 && (
          <Anchor component={Link} href="/guardia/puerta" size="sm" mt="xs" display="block">
            Ver los {datos.ingresos.length} ingresos
          </Anchor>
        )}
      </TarjetaIngresos>
    </Stack>
  );
}
