'use client';

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconChevronRight,
  IconConfetti,
  IconListDetails,
  IconMoonStars,
  IconBrandWhatsapp,
  IconPencil,
  IconPlus,
  IconStar,
  IconTrophy,
  IconUserCheck,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { enlaceDeWhatsApp, mensajeDeLaNoche } from './aviso';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { mesDe } from '@/shared/utilidades/calendario';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { tituloDeFecha } from '@/shared/utilidades/fechas';
import {
  agregarEvento,
  editarNoche,
  elegirPremio,
  invitar,
  quitarEvento,
  quitarInvitacion,
} from './acciones';
import type { DetalleDeNoche } from './servicios/detalles';
import { CamposNoche } from './CamposNoche';
import { DialogosDeListas, GrupoDeListas, type DialogoLista } from './ListasVigentes';
import { estadosDeNoche } from './nombres';
import { CamposDocumento, FilaPersona } from './Personas';

type Dialogo =
  | { tipo: 'noche' }
  | { tipo: 'premio'; ambiente: { id: number; nombre: string } }
  | { tipo: 'evento' }
  | { tipo: 'invitado' }
  | NonNullable<DialogoLista>
  | null;

const estados = estadosDeNoche;

function Seccion({
  icono: Icono,
  color,
  titulo,
  descripcion,
  accion,
  children,
}: Readonly<{
  icono: Icon;
  color: string;
  titulo: string;
  descripcion: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <div>
          <Group justify="space-between" gap="sm" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <ThemeIcon variant="light" color={color} size={40} radius="md">
                <Icono size={22} stroke={1.7} />
              </ThemeIcon>
              <Title order={3} size="h4">
                {titulo}
              </Title>
            </Group>
            {accion}
          </Group>
          {/* Bajo el título y a todo el ancho: al lado del botón quedaba angosta en el teléfono. */}
          <Text size="sm" c="dimmed" lh={1.35} mt={8}>
            {descripcion}
          </Text>
        </div>
        {children}
      </Stack>
    </Card>
  );
}

const botonAgregar = (texto: string, alTocar: () => void, etiqueta?: string) => (
  <Button
    size="sm"
    mih={44}
    variant="light"
    leftSection={<IconPlus size={16} />}
    onClick={alTocar}
    aria-label={etiqueta}
  >
    {texto}
  </Button>
);

/** El premio de un ambiente: hasta cinco productos del catálogo, cada uno con su cantidad. */
function FormularioPremio({
  detalle,
  ambienteId,
  alTerminar,
}: Readonly<{ detalle: DetalleDeNoche; ambienteId: number; alTerminar: () => void }>) {
  const actuales = detalle.premios.filter((p) => p.ambienteId === ambienteId);
  const [elegidos, setElegidos] = useState(actuales.map((p) => String(p.productoId)));
  const [cantidades, setCantidades] = useState<Record<string, number>>(
    Object.fromEntries(actuales.map((p) => [String(p.productoId), p.cantidad])),
  );
  const categorias = [...new Set(detalle.productos.map((p) => p.categoria))];
  // Las botellas primero: es lo que suele sortearse.
  const grupos = categorias
    .toSorted((a, b) => Number(b === 'Botellas') - Number(a === 'Botellas'))
    .map((categoria) => ({
      group: categoria,
      items: detalle.productos
        .filter((p) => p.categoria === categoria)
        .map((p) => ({ value: String(p.id), label: p.nombre })),
    }));
  const nombreDe = (id: string) => detalle.productos.find((p) => String(p.id) === id)?.nombre;
  const items = elegidos.map((id) => ({ productoId: Number(id), cantidad: cantidades[id] ?? 1 }));

  return (
    <FormularioAccion accion={elegirPremio} textoEnviar="Guardar premio" alTerminar={alTerminar}>
      <input type="hidden" name="fecha" value={detalle.noche.fecha} />
      <input type="hidden" name="ambienteId" value={ambienteId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <MultiSelect
        label="Productos del catálogo"
        description="Hasta cinco. Sin productos, el ambiente queda sin premio."
        placeholder={elegidos.length === 0 ? 'Elige una o más botellas' : undefined}
        data={grupos}
        value={elegidos}
        onChange={setElegidos}
        maxValues={5}
        searchable
        nothingFoundMessage="No hay productos con ese nombre"
        size="md"
        comboboxProps={{ zIndex: 500 }}
      />
      {elegidos.map((id) => (
        <Group key={id} justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>
            {nombreDe(id)}
          </Text>
          <NumberInput
            aria-label={`Cantidad de ${nombreDe(id)}`}
            value={cantidades[id] ?? 1}
            onChange={(valor) => setCantidades({ ...cantidades, [id]: Number(valor) || 1 })}
            min={1}
            max={10}
            allowDecimal={false}
            w={96}
            size="md"
          />
        </Group>
      ))}
    </FormularioAccion>
  );
}

// La noche en detalle (pedido del Product Owner, 12 nov): además del precio de entrada, el premio
// del sorteo de cada ambiente, los eventos, las listas (cumpleaños, bailarines) y los invitados que la
// puerta debe reconocer. Con la noche cerrada todo queda de solo lectura (RN-26).
export function DetalleNoche({ detalle }: Readonly<{ detalle: DetalleDeNoche }>) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const cerrar = () => setDialogo(null);
  const { noche } = detalle;
  const editable = noche.estado !== 'cerrada';
  const estado = estados[noche.estado];
  const premioDe = (ambienteId: number) =>
    detalle.premios
      .filter((p) => p.ambienteId === ambienteId)
      .map((p) => `${p.cantidad} × ${p.producto}`)
      .join(' + ');

  return (
    <Stack gap="md" maw={1100}>
      <Anchor
        component={Link}
        href={`/admin/calendario?mes=${mesDe(noche.fecha)}&dia=${noche.fecha}`}
        size="sm"
        mih={44}
        display="inline-flex"
        style={{ alignItems: 'center' }}
      >
        <Group gap={4}>
          <IconArrowLeft size={16} /> Calendario de noches
        </Group>
      </Anchor>

      <EncabezadoPagina
        icono={IconMoonStars}
        titulo={tituloDeFecha(noche.fecha)}
        descripcion={
          <>
            Entrada {formatearPesos(noche.precioEntrada)}
            {noche.nota && ` · ${noche.nota}`}
          </>
        }
      >
        <Group gap="xs">
          <Badge size="lg" color={estado.color} variant="light">
            {estado.texto}
          </Badge>
          {editable && (
            <>
              <Button
                onClick={() => {
                  // El enlace del mensaje lleva al dominio con que se abrió la aplicación.
                  const mensaje = mensajeDeLaNoche(
                    {
                      fecha: noche.fecha,
                      precioEntrada: noche.precioEntrada,
                      nota: noche.nota,
                      premios: detalle.ambientes.flatMap((ambiente) => {
                        const premio = premioDe(ambiente.id);
                        return premio ? [{ ambiente: ambiente.nombre, premio }] : [];
                      }),
                      eventos: detalle.eventos,
                    },
                    window.location.origin,
                  );
                  window.open(enlaceDeWhatsApp(mensaje), '_blank', 'noopener');
                }}
                size="sm"
                mih={44}
                variant="default"
                leftSection={<IconBrandWhatsapp size={16} />}
              >
                Avisar por WhatsApp
              </Button>
              <Button
                size="sm"
                mih={44}
                variant="default"
                leftSection={<IconPencil size={16} />}
                onClick={() => setDialogo({ tipo: 'noche' })}
              >
                Entrada y nota
              </Button>
              <Button
                component={Link}
                href={`/admin/asignacion?fecha=${noche.fecha}`}
                size="sm"
                mih={44}
                leftSection={<IconUserCheck size={16} />}
              >
                Turnos
              </Button>
            </>
          )}
        </Group>
      </EncabezadoPagina>

      {!editable && (
        <Alert color="gray" variant="light">
          La noche está cerrada: sus detalles quedan como registro y ya no cambian.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Seccion
          icono={IconTrophy}
          color="yellow"
          titulo="Premio del sorteo"
          descripcion="Cada ambiente sortea el suyo entre los tickets de la noche."
        >
          <Stack gap="sm">
            {detalle.ambientes.map((ambiente) => {
              const premio = premioDe(ambiente.id);
              const sorteo = detalle.sorteos.find((s) => s.ambienteId === ambiente.id);
              return (
                <Group key={ambiente.id} justify="space-between" wrap="nowrap" gap="xs">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={700}>
                      {ambiente.nombre}
                    </Text>
                    <Text size="sm" c={premio ? undefined : 'dimmed'}>
                      {premio || 'Sin premio todavía'}
                    </Text>
                  </div>
                  {sorteo ? (
                    <Badge color="yellow" variant="light" size="lg" tt="none">
                      Ganó el ticket {sorteo.ticket}
                    </Badge>
                  ) : (
                    editable && (
                      <Button
                        size="sm"
                        mih={44}
                        variant="light"
                        color="yellow"
                        onClick={() => setDialogo({ tipo: 'premio', ambiente })}
                        aria-label={`${premio ? 'Cambiar' : 'Elegir'} el premio de ${ambiente.nombre}`}
                      >
                        {premio ? 'Cambiar' : 'Elegir'}
                      </Button>
                    )
                  )}
                </Group>
              );
            })}
          </Stack>
        </Seccion>

        <Seccion
          icono={IconConfetti}
          color="pink"
          titulo="Eventos"
          descripcion="Lo que viene esta noche: shows, banda, robot de shots."
          accion={
            editable &&
            botonAgregar('Evento', () => setDialogo({ tipo: 'evento' }), 'Agregar evento')
          }
        >
          {detalle.eventos.length === 0 && (
            <Text size="sm" c="dimmed">
              Sin eventos anunciados.
            </Text>
          )}
          <Stack gap="xs">
            {detalle.eventos.map((evento) => (
              <Group key={evento.numero} justify="space-between" wrap="nowrap" gap="xs">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge variant="light" color="pink" size="lg" w={64} tt="none">
                    {evento.hora ?? '—'}
                  </Badge>
                  <Text fw={600} truncate>
                    {evento.nombre}
                  </Text>
                </Group>
                {editable && (
                  <BotonAccion
                    accion={quitarEvento}
                    datos={{ fecha: noche.fecha, numero: evento.numero }}
                    etiqueta="Quitar"
                    variant="subtle"
                    color="red"
                    px="xs"
                    aria-label={`Quitar ${evento.nombre}`}
                    confirmar={`¿Quitar «${evento.nombre}» de la noche?`}
                  />
                )}
              </Group>
            ))}
          </Stack>
        </Seccion>
      </SimpleGrid>

      <Seccion
        icono={IconListDetails}
        color="violeta"
        titulo="Listas"
        descripcion="Las de esta noche y las que siguen vigentes, como los clientes frecuentes. Quien organiza envía los datos antes y en la puerta no se escriben."
        accion={
          editable && botonAgregar('Lista', () => setDialogo({ tipo: 'lista' }), 'Nueva lista')
        }
      >
        {detalle.listas.length === 0 ? (
          <Text size="sm" c="dimmed">
            Ninguna lista vale esta noche.
          </Text>
        ) : (
          <GrupoDeListas listas={detalle.listas} noche={noche.fecha} abrir={setDialogo} />
        )}
        <Button
          component={Link}
          href="/admin/listas"
          size="sm"
          mih={44}
          variant="subtle"
          rightSection={<IconChevronRight size={16} />}
          style={{ alignSelf: 'flex-start' }}
        >
          Todas las listas
        </Button>
      </Seccion>

      <Seccion
        icono={IconStar}
        color="orange"
        titulo="Invitados"
        descripcion="Personas invitadas una por una: un cliente habitual, un amigo del DJ. Suelen entrar gratis."
        accion={
          editable &&
          botonAgregar('Invitado', () => setDialogo({ tipo: 'invitado' }), 'Agregar invitado')
        }
      >
        {detalle.invitados.length === 0 && (
          <Text size="sm" c="dimmed">
            Sin invitados para esta noche.
          </Text>
        )}
        <Stack gap={4}>
          {detalle.invitados.map((persona) => (
            <FilaPersona
              key={persona.documento}
              persona={persona}
              detalle={
                <>
                  {` · invita ${persona.invitadoPor}`}
                  {persona.gratis ? ' · gratis' : ' · paga entrada'}
                </>
              }
              // Quien ya entró queda: su invitación es el registro de cómo entró.
              quitar={
                editable && !persona.entroEn
                  ? {
                      accion: quitarInvitacion,
                      datos: { fecha: noche.fecha, documento: persona.documento },
                      confirmar: `¿Quitar a ${persona.nombre} ${persona.apellido} de esta noche?`,
                    }
                  : undefined
              }
            />
          ))}
        </Stack>
      </Seccion>

      <Modal opened={dialogo?.tipo === 'noche'} onClose={cerrar} title="Entrada y nota">
        <FormularioAccion accion={editarNoche} textoEnviar="Guardar" alTerminar={cerrar}>
          <input type="hidden" name="fecha" value={noche.fecha} />
          <CamposNoche precio={noche.precioEntrada} nota={noche.nota} />
        </FormularioAccion>
      </Modal>

      <Modal
        opened={dialogo?.tipo === 'premio'}
        onClose={cerrar}
        title={dialogo?.tipo === 'premio' ? `Premio de ${dialogo.ambiente.nombre}` : ''}
      >
        {dialogo?.tipo === 'premio' && (
          <FormularioPremio
            detalle={detalle}
            ambienteId={dialogo.ambiente.id}
            alTerminar={cerrar}
          />
        )}
      </Modal>

      <Modal opened={dialogo?.tipo === 'evento'} onClose={cerrar} title="Agregar evento">
        <FormularioAccion accion={agregarEvento} textoEnviar="Agregar" alTerminar={cerrar}>
          <input type="hidden" name="fecha" value={noche.fecha} />
          <TextInput
            name="nombre"
            label="Evento"
            placeholder="Show de baile"
            size="md"
            required
            maxLength={80}
          />
          <TextInput name="hora" label="Hora" type="time" size="md" />
        </FormularioAccion>
      </Modal>

      <DialogosDeListas
        dialogo={
          dialogo?.tipo === 'lista' || dialogo?.tipo === 'integrante' || dialogo?.tipo === 'pegar'
            ? dialogo
            : null
        }
        cerrar={cerrar}
        desde={noche.fecha}
      />

      <Modal opened={dialogo?.tipo === 'invitado'} onClose={cerrar} title="Agregar invitado">
        {dialogo?.tipo === 'invitado' && (
          <FormularioAccion accion={invitar} textoEnviar="Agregar" alTerminar={cerrar}>
            <input type="hidden" name="fecha" value={noche.fecha} />
            <CamposDocumento />
            <TextInput
              name="invitadoPor"
              label="Quién lo invita"
              placeholder="DJ de la noche"
              size="md"
              required
              maxLength={80}
            />
            <Checkbox name="gratis" label="Entra gratis" defaultChecked />
          </FormularioAccion>
        )}
      </Modal>
    </Stack>
  );
}
