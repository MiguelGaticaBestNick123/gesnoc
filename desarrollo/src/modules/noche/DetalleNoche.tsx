'use client';

import {
  Accordion,
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
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconClipboardText,
  IconConfetti,
  IconListDetails,
  IconMoonStars,
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
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { mesDe } from '@/shared/utilidades/calendario';
import { formatearPesos } from '@/shared/utilidades/dinero';
import { formatearHora, tituloDeFecha } from '@/shared/utilidades/fechas';
import { formatearDocumento } from '@/shared/utilidades/rut';
import {
  agregarEvento,
  editarNoche,
  elegirPremio,
  guardarLista,
  invitar,
  pegarLista,
  quitarEvento,
  quitarInvitacion,
  quitarLista,
} from './acciones';
import type { InvitacionDeLaNoche } from './repositorios/detalles';
import type { DetalleDeNoche } from './servicios/detalles';

type Lista = DetalleDeNoche['listas'][number];

type Dialogo =
  | { tipo: 'noche' }
  | { tipo: 'premio'; ambiente: { id: number; nombre: string } }
  | { tipo: 'evento' }
  | { tipo: 'lista'; lista?: Lista }
  | { tipo: 'persona'; lista: Lista }
  | { tipo: 'pegar'; lista: Lista }
  | { tipo: 'invitado' }
  | null;

const estados = {
  programada: { texto: 'Programada', color: 'violeta' },
  abierta: { texto: 'Abierta', color: 'green' },
  cerrada: { texto: 'Cerrada', color: 'gray' },
} as const;

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

/** Quien ya entró, con su hora: la puerta lo registró con su documento. */
const marcaDeEntrada = (persona: InvitacionDeLaNoche) =>
  persona.entroEn ? (
    <Badge color="green" variant="light" tt="none">
      Entró {formatearHora(persona.entroEn)}
    </Badge>
  ) : null;

function FilaPersona({
  persona,
  fecha,
  editable,
  detalle,
}: Readonly<{
  persona: InvitacionDeLaNoche;
  fecha: string;
  editable: boolean;
  detalle?: React.ReactNode;
}>) {
  const nombre = `${persona.nombre} ${persona.apellido}`;
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs" py={4}>
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {nombre}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {formatearDocumento(persona.documento)}
          {detalle}
        </Text>
      </div>
      <Group gap={6} wrap="nowrap">
        {marcaDeEntrada(persona)}
        {editable && !persona.entroEn && (
          <BotonAccion
            accion={quitarInvitacion}
            datos={{ fecha, documento: persona.documento }}
            etiqueta="Quitar"
            variant="subtle"
            color="red"
            px="xs"
            aria-label={`Quitar a ${nombre}`}
          />
        )}
      </Group>
    </Group>
  );
}

/** Documento con su tipo: el guardia y la administración lo eligen, no se adivina (RN-21). */
function CamposDocumento() {
  const [tipo, setTipo] = useState('rut');
  return (
    <>
      <input type="hidden" name="tipoDocumento" value={tipo} />
      <SegmentedControl
        value={tipo}
        onChange={setTipo}
        aria-label="Tipo de documento"
        data={[
          { value: 'rut', label: 'RUT' },
          { value: 'extranjero', label: 'Extranjero' },
        ]}
      />
      <TextInput
        name="documento"
        label="Documento"
        placeholder={tipo === 'rut' ? '12.345.678-5' : 'Letras y números'}
        size="md"
        required
        autoComplete="off"
      />
      <Group grow>
        <TextInput name="nombre" label="Nombre" size="md" required autoComplete="off" />
        <TextInput name="apellido" label="Apellido" size="md" required autoComplete="off" />
      </Group>
    </>
  );
}

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

function TarjetaLista({
  lista,
  fecha,
  editable,
  abrir,
}: Readonly<{
  lista: Lista;
  fecha: string;
  editable: boolean;
  abrir: (dialogo: Dialogo) => void;
}>) {
  const entraron = lista.personas.filter((p) => p.entroEn).length;
  return (
    <Accordion.Item value={String(lista.numero)}>
      <Accordion.Control aria-label={`Lista ${lista.nombre}`}>
        <Group gap="xs" wrap="nowrap">
          <div style={{ minWidth: 0, flex: 1 }}>
            <Group gap={6}>
              <Text fw={700} truncate>
                {lista.nombre}
              </Text>
              {lista.gratis ? (
                <Badge color="green" variant="light" tt="none">
                  Entran gratis
                </Badge>
              ) : (
                <Badge color="gray" variant="light" tt="none">
                  Pagan entrada
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {lista.personas.length} {lista.personas.length === 1 ? 'persona' : 'personas'}
              {entraron > 0 && ` · ${entraron} ${entraron === 1 ? 'entró' : 'entraron'}`} · organiza{' '}
              {lista.responsable}
            </Text>
          </div>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap={4}>
          {lista.personas.length === 0 && (
            <Text size="sm" c="dimmed">
              Todavía no tiene personas. Agrégalas una por una o pega la lista que te enviaron.
            </Text>
          )}
          {lista.personas.map((persona) => (
            <FilaPersona
              key={persona.documento}
              persona={persona}
              fecha={fecha}
              editable={editable}
            />
          ))}
          {editable && (
            <Group gap="xs" mt="sm">
              <Button
                size="sm"
                mih={44}
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() => abrir({ tipo: 'persona', lista })}
                aria-label={`Agregar persona a ${lista.nombre}`}
              >
                Persona
              </Button>
              <Button
                size="sm"
                mih={44}
                variant="light"
                leftSection={<IconClipboardText size={16} />}
                onClick={() => abrir({ tipo: 'pegar', lista })}
                aria-label={`Pegar personas en ${lista.nombre}`}
              >
                Pegar lista
              </Button>
              <Button
                size="sm"
                mih={44}
                variant="default"
                leftSection={<IconPencil size={16} />}
                onClick={() => abrir({ tipo: 'lista', lista })}
                aria-label={`Editar ${lista.nombre}`}
              >
                Editar
              </Button>
              <BotonAccion
                accion={quitarLista}
                datos={{ fecha, numero: lista.numero }}
                etiqueta="Eliminar"
                variant="subtle"
                color="red"
                aria-label={`Eliminar ${lista.nombre}`}
                confirmar={`¿Eliminar ${lista.nombre} con sus ${lista.personas.length} personas?`}
              />
            </Group>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
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
                        aria-label={`Elegir el premio de ${ambiente.nombre}`}
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
        descripcion="Quien organiza envía los datos antes y en la puerta no se escriben. Un cumpleaños paga su entrada; los bailarines entran gratis."
        accion={
          editable && botonAgregar('Lista', () => setDialogo({ tipo: 'lista' }), 'Nueva lista')
        }
      >
        {detalle.listas.length === 0 ? (
          <Text size="sm" c="dimmed">
            Sin listas para esta noche.
          </Text>
        ) : (
          <Accordion variant="separated" multiple chevronPosition="right">
            {detalle.listas.map((lista) => (
              <TarjetaLista
                key={lista.numero}
                lista={lista}
                fecha={noche.fecha}
                editable={editable}
                abrir={setDialogo}
              />
            ))}
          </Accordion>
        )}
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
              fecha={noche.fecha}
              editable={editable}
              detalle={
                <>
                  {` · invita ${persona.invitadoPor}`}
                  {persona.gratis ? ' · gratis' : ' · paga entrada'}
                </>
              }
            />
          ))}
        </Stack>
      </Seccion>

      <Modal opened={dialogo?.tipo === 'noche'} onClose={cerrar} title="Entrada y nota">
        <FormularioAccion accion={editarNoche} textoEnviar="Guardar" alTerminar={cerrar}>
          <input type="hidden" name="fecha" value={noche.fecha} />
          <CampoPesos
            name="precioEntrada"
            label="Precio de entrada"
            valorInicial={noche.precioEntrada}
            size="md"
            required
          />
          <Textarea
            name="nota"
            label="Nota para el equipo"
            defaultValue={noche.nota ?? ''}
            maxLength={280}
            autosize
            minRows={2}
            size="md"
          />
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

      <Modal
        opened={dialogo?.tipo === 'lista'}
        onClose={cerrar}
        title={dialogo?.tipo === 'lista' && dialogo.lista ? 'Editar lista' : 'Nueva lista'}
      >
        {dialogo?.tipo === 'lista' && (
          <FormularioAccion accion={guardarLista} textoEnviar="Guardar" alTerminar={cerrar}>
            <input type="hidden" name="fecha" value={noche.fecha} />
            {dialogo.lista && <input type="hidden" name="numero" value={dialogo.lista.numero} />}
            <TextInput
              name="nombre"
              label="Nombre de la lista"
              placeholder="Cumpleaños de Camila"
              defaultValue={dialogo.lista?.nombre}
              size="md"
              required
              maxLength={60}
            />
            <TextInput
              name="responsable"
              label="Quién la organiza"
              placeholder="Camila Rojas"
              defaultValue={dialogo.lista?.responsable}
              size="md"
              required
              maxLength={80}
            />
            <Checkbox
              name="gratis"
              label="Entran gratis"
              description="Por ejemplo, los bailarines del show. Un cumpleaños paga su entrada."
              defaultChecked={dialogo.lista?.gratis}
            />
          </FormularioAccion>
        )}
      </Modal>

      <Modal
        opened={dialogo?.tipo === 'persona'}
        onClose={cerrar}
        title={dialogo?.tipo === 'persona' ? `Agregar a ${dialogo.lista.nombre}` : ''}
      >
        {dialogo?.tipo === 'persona' && (
          <FormularioAccion accion={invitar} textoEnviar="Agregar" alTerminar={cerrar}>
            <input type="hidden" name="fecha" value={noche.fecha} />
            <input type="hidden" name="listaNumero" value={dialogo.lista.numero} />
            <CamposDocumento />
          </FormularioAccion>
        )}
      </Modal>

      <Modal
        opened={dialogo?.tipo === 'pegar'}
        onClose={cerrar}
        title={dialogo?.tipo === 'pegar' ? `Pegar personas en ${dialogo.lista.nombre}` : ''}
        size="lg"
      >
        {dialogo?.tipo === 'pegar' && (
          <FormularioAccion
            accion={pegarLista}
            textoEnviar="Agregar a la lista"
            alTerminar={cerrar}
          >
            <input type="hidden" name="fecha" value={noche.fecha} />
            <input type="hidden" name="listaNumero" value={dialogo.lista.numero} />
            <Textarea
              name="texto"
              label="Una persona por línea, con su RUT y su nombre"
              description="Sirve tal como llega por mensaje. Si una línea no se entiende, no se agrega nadie y se indica cuál corregir."
              placeholder={'12.345.678-5 Camila Rojas\nIgnacio Bravo, 17654321-3'}
              autosize
              minRows={6}
              maxRows={14}
              size="md"
              required
            />
          </FormularioAccion>
        )}
      </Modal>

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
