'use client';

import {
  Accordion,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { IconClipboardText, IconListDetails, IconPencil, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import {
  agregarIntegrante,
  guardarLista,
  pegarLista,
  quitarIntegrante,
  quitarLista,
} from './acciones';
import { CamposDocumento, FilaPersona } from './Personas';
import type { ListaConPersonas, PantallaListas as DatosPantalla } from './servicios/listas';
import { describirVigencia, duracionDe, type Duracion } from './vigencia';

// Listas con vigencia (pedido del Product Owner, 18 nov): de una noche (un cumpleaños), de varias
// (los bailarines de una temporada) o sin término (los clientes frecuentes). Se ven en la página de
// cada noche en que valen y en «Listas», donde se administran sin depender de una noche.

export type Lista = ListaConPersonas;

export type DialogoLista =
  | { tipo: 'lista'; lista?: Lista }
  | { tipo: 'integrante'; lista: Lista }
  | { tipo: 'pegar'; lista: Lista }
  | null;

const plural = (cantidad: number, uno: string, varios: string) =>
  `${cantidad} ${cantidad === 1 ? uno : varios}`;

const ayudaDuracion: Record<Duracion, string> = {
  noche: 'Por ejemplo, un cumpleaños: la puerta la reconoce solo esa noche.',
  hasta: 'Por ejemplo, los bailarines de la temporada: vale hasta la noche que elijas.',
  siempre:
    'Por ejemplo, los clientes frecuentes: vale todas las noches hasta que la quites. Si alguien entró con ella, queda como registro.',
};

/** Una lista con su vigencia y sus personas; vista desde una noche, con quién ya entró esa noche. */
function TarjetaLista({
  lista,
  noche,
  abrir,
}: Readonly<{ lista: Lista; noche?: string; abrir: (dialogo: DialogoLista) => void }>) {
  const entraron = lista.personas.filter((p) => p.entroEn).length;
  const personas = lista.personas.length;
  return (
    <Accordion.Item value={String(lista.id)}>
      <Accordion.Control>
        <VisuallyHidden>Lista </VisuallyHidden>
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
              {describirVigencia(lista, noche)}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {plural(personas, 'persona', 'personas')}
              {entraron > 0 && ` · ${plural(entraron, 'entró', 'entraron')}`} · organiza{' '}
              {lista.responsable}
            </Text>
          </div>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap={4}>
          {personas === 0 && (
            <Text size="sm" c="dimmed">
              Todavía no tiene personas. Agrégalas una por una o pega la lista que te enviaron.
            </Text>
          )}
          {lista.personas.map((persona) => (
            <FilaPersona
              key={persona.documento}
              persona={persona}
              quitar={
                lista.editable
                  ? {
                      accion: quitarIntegrante,
                      datos: { listaId: lista.id, documento: persona.documento },
                      confirmar: `¿Quitar a ${persona.nombre} ${persona.apellido} de «${lista.nombre}»? La puerta deja de reconocerla.`,
                    }
                  : undefined
              }
            />
          ))}
          {lista.editable && (
            <Group gap="xs" mt="sm">
              <Button
                size="sm"
                mih={44}
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() => abrir({ tipo: 'integrante', lista })}
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
                aria-label={`Pegar lista en ${lista.nombre}`}
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
                datos={{ id: lista.id }}
                etiqueta="Quitar"
                variant="subtle"
                color="red"
                aria-label={`Quitar ${lista.nombre}`}
                confirmar={
                  duracionDe(lista) === 'noche'
                    ? `¿Eliminar «${lista.nombre}» con ${personas === 1 ? 'su persona' : `sus ${personas} personas`}?`
                    : `¿Quitar «${lista.nombre}»? La puerta deja de reconocer a sus personas. Si alguien ya entró con ella, queda como registro.`
                }
              />
            </Group>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

/** Las listas en acordeón: se abren para ver y cambiar sus personas. */
export function GrupoDeListas({
  listas,
  noche,
  abrir,
}: Readonly<{ listas: Lista[]; noche?: string; abrir: (dialogo: DialogoLista) => void }>) {
  return (
    <Accordion variant="separated" multiple chevronPosition="right">
      {listas.map((lista) => (
        <TarjetaLista key={lista.id} lista={lista} noche={noche} abrir={abrir} />
      ))}
    </Accordion>
  );
}

/** Crear o editar una lista: nombre, quién la organiza, si entran gratis y cuánto dura. */
function FormularioLista({
  lista,
  desde,
  alTerminar,
}: Readonly<{ lista?: Lista; desde: string; alTerminar: () => void }>) {
  const [duracion, setDuracion] = useState<Duracion>(lista ? duracionDe(lista) : 'noche');
  const [inicio, setInicio] = useState(lista?.desde ?? desde);
  return (
    <FormularioAccion accion={guardarLista} textoEnviar="Guardar" alTerminar={alTerminar}>
      {lista && <input type="hidden" name="id" value={lista.id} />}
      <input type="hidden" name="duracion" value={duracion} />
      <TextInput
        name="nombre"
        label="Nombre de la lista"
        placeholder="Cumpleaños de Camila"
        defaultValue={lista?.nombre}
        size="md"
        required
        maxLength={60}
      />
      <TextInput
        name="responsable"
        label="Quién la organiza"
        placeholder="Camila Rojas"
        defaultValue={lista?.responsable}
        size="md"
        required
        maxLength={80}
      />
      <Checkbox
        name="gratis"
        label="Entran gratis"
        description="Por ejemplo, los bailarines o los clientes frecuentes. Un cumpleaños paga su entrada."
        defaultChecked={lista?.gratis}
      />
      <Stack gap={6}>
        <Text size="sm" fw={500} id="duracion-de-la-lista">
          ¿Cuánto dura?
        </Text>
        <SegmentedControl
          value={duracion}
          onChange={(valor) => setDuracion(valor as Duracion)}
          aria-labelledby="duracion-de-la-lista"
          fullWidth
          data={[
            { value: 'noche', label: 'Una noche' },
            { value: 'hasta', label: 'Varias' },
            { value: 'siempre', label: 'Sin término' },
          ]}
        />
        <Text size="xs" c="dimmed">
          {ayudaDuracion[duracion]}
        </Text>
      </Stack>
      {/* Una bajo la otra: lado a lado, en el teléfono la fecha no cabía junto al ícono. */}
      <TextInput
        type="date"
        name="desde"
        label={duracion === 'noche' ? 'Noche' : 'Desde'}
        value={inicio}
        onChange={(evento) => setInicio(evento.currentTarget.value)}
        size="md"
        required
      />
      {duracion === 'hasta' && (
        <TextInput
          type="date"
          name="hasta"
          label="Hasta"
          defaultValue={lista?.hasta && lista.hasta !== lista.desde ? lista.hasta : undefined}
          min={inicio}
          size="md"
          required
        />
      )}
    </FormularioAccion>
  );
}

/** Los diálogos de las listas: crear o editar, agregar una persona y pegar las que enviaron. */
export function DialogosDeListas({
  dialogo,
  cerrar,
  desde,
}: Readonly<{ dialogo: DialogoLista; cerrar: () => void; desde: string }>) {
  return (
    <>
      <Modal
        opened={dialogo?.tipo === 'lista'}
        onClose={cerrar}
        title={dialogo?.tipo === 'lista' && dialogo.lista ? 'Editar lista' : 'Nueva lista'}
      >
        {dialogo?.tipo === 'lista' && (
          <FormularioLista lista={dialogo.lista} desde={desde} alTerminar={cerrar} />
        )}
      </Modal>

      <Modal
        opened={dialogo?.tipo === 'integrante'}
        onClose={cerrar}
        title={dialogo?.tipo === 'integrante' ? `Agregar a ${dialogo.lista.nombre}` : ''}
      >
        {dialogo?.tipo === 'integrante' && (
          <FormularioAccion accion={agregarIntegrante} textoEnviar="Agregar" alTerminar={cerrar}>
            <input type="hidden" name="listaId" value={dialogo.lista.id} />
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
            <input type="hidden" name="listaId" value={dialogo.lista.id} />
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
    </>
  );
}

function GrupoConTitulo({
  titulo,
  vacio,
  listas,
  abrir,
}: Readonly<{
  titulo: string;
  vacio: string;
  listas: Lista[];
  abrir: (dialogo: DialogoLista) => void;
}>) {
  return (
    <Stack gap="sm">
      <Title order={2} size="h4">
        {titulo} ({listas.length})
      </Title>
      {listas.length === 0 ? (
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            {vacio}
          </Text>
        </Card>
      ) : (
        <GrupoDeListas listas={listas} abrir={abrir} />
      )}
    </Stack>
  );
}

/**
 * HU-34, como la ajustó el Product Owner (18 nov): las listas que la puerta reconoce, vigentes y
 * por venir, sin depender de una noche. Las que ya terminaron quedan en la página de sus noches.
 */
export function PantallaListas({ datos }: Readonly<{ datos: DatosPantalla }>) {
  const [dialogo, setDialogo] = useState<DialogoLista>(null);
  const cerrar = () => setDialogo(null);
  const vigentes = datos.listas.filter((lista) => lista.desde <= datos.hoy);
  const proximas = datos.listas.filter((lista) => lista.desde > datos.hoy);
  return (
    <Stack gap="lg" maw={900}>
      <EncabezadoPagina
        icono={IconListDetails}
        titulo="Listas"
        descripcion="De una noche, de varias o sin término. La puerta reconoce a sus personas mientras la lista está vigente."
      >
        <Button
          size="sm"
          mih={44}
          leftSection={<IconPlus size={16} />}
          onClick={() => setDialogo({ tipo: 'lista' })}
        >
          Nueva lista
        </Button>
      </EncabezadoPagina>
      <GrupoConTitulo
        titulo="Vigentes"
        vacio="Ninguna lista vale esta noche."
        listas={vigentes}
        abrir={setDialogo}
      />
      <GrupoConTitulo
        titulo="Próximas"
        vacio="No hay listas que empiecen más adelante."
        listas={proximas}
        abrir={setDialogo}
      />
      <DialogosDeListas dialogo={dialogo} cerrar={cerrar} desde={datos.hoy} />
    </Stack>
  );
}
