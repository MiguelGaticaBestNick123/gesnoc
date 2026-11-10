'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NativeSelect,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { BotonAccion } from '@/shared/ui/BotonAccion';
import { CampoPesos } from '@/shared/ui/CampoPesos';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { formatearPesos } from '@/shared/utilidades/dinero';
import {
  cambiarProductoActivo,
  crearCategoria,
  crearProducto,
  editarCategoria,
  editarProducto,
  eliminarCategoria,
} from './acciones';
import type { Estacion } from './repositorios/ambientes';
import type { Categoria, Producto } from './repositorios/catalogo';

interface Props {
  categorias: Categoria[];
  productos: Producto[];
  estaciones: Estacion[];
}

type Dialogo =
  { tipo: 'categoria'; categoria?: Categoria } | { tipo: 'producto'; producto?: Producto } | null;

function CamposCategoria({
  categoria,
  estaciones,
}: Readonly<{ categoria?: Categoria; estaciones: Estacion[] }>) {
  const [regla, setRegla] = useState(categoria?.reglaRuteo ?? 'barra_ambiente');

  return (
    <>
      <TextInput name="nombre" label="Nombre" defaultValue={categoria?.nombre} size="md" required />
      <NativeSelect
        name="reglaRuteo"
        label="Dónde se prepara"
        value={regla}
        onChange={(evento) => setRegla(evento.currentTarget.value)}
        size="md"
        data={[
          { value: 'barra_ambiente', label: 'En la barra del ambiente de la cuenta' },
          { value: 'fija', label: 'Siempre en una misma estación' },
        ]}
      />
      {regla === 'fija' && (
        <NativeSelect
          name="estacionId"
          label="Estación"
          defaultValue={String(categoria?.estacionId ?? '')}
          size="md"
          data={[
            { value: '', label: 'Elige una estación' },
            ...estaciones.map((e) => ({ value: String(e.id), label: e.nombre })),
          ]}
        />
      )}
    </>
  );
}

function CamposProducto({
  producto,
  categorias,
  estaciones,
}: Readonly<{ producto?: Producto; categorias: Categoria[]; estaciones: Estacion[] }>) {
  return (
    <>
      <TextInput name="nombre" label="Nombre" defaultValue={producto?.nombre} size="md" required />
      <CampoPesos name="precio" label="Precio" valorInicial={producto?.precio} size="md" required />
      <NativeSelect
        name="categoriaId"
        label="Categoría"
        defaultValue={String(producto?.categoriaId ?? '')}
        size="md"
        data={categorias.map((c) => ({ value: String(c.id), label: c.nombre }))}
      />
      <NativeSelect
        name="estacionId"
        label="Enviar a"
        description="Solo si este producto no sigue la regla de su categoría."
        defaultValue={String(producto?.estacionId ?? '0')}
        size="md"
        data={[
          { value: '0', label: 'Según su categoría' },
          ...estaciones.map((e) => ({ value: String(e.id), label: e.nombre })),
        ]}
      />
    </>
  );
}

export function Catalogo({ categorias, productos, estaciones }: Readonly<Props>) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const cerrar = () => setDialogo(null);

  const nombreEstacion = (id: number | null) => estaciones.find((e) => e.id === id)?.nombre;
  const reglaDe = (categoria: Categoria) =>
    categoria.reglaRuteo === 'fija' ? nombreEstacion(categoria.estacionId) : 'Barra del ambiente';

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Catálogo</Title>
        <Text c="dimmed" size="sm">
          Categorías, productos, precios y dónde se prepara cada cosa.
        </Text>
      </div>

      <Tabs defaultValue="productos">
        <Tabs.List>
          <Tabs.Tab value="productos">Productos</Tabs.Tab>
          <Tabs.Tab value="categorias">Categorías</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="productos" pt="md">
          <Stack gap="sm">
            <Button size="sm" mih={44} onClick={() => setDialogo({ tipo: 'producto' })}>
              Agregar producto
            </Button>
            {productos.map((producto) => (
              <Card key={producto.id} withBorder padding="sm">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <div>
                    <Group gap="xs">
                      <Text fw={600}>{producto.nombre}</Text>
                      {!producto.activo && <Badge color="gray">Inactivo</Badge>}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {categorias.find((c) => c.id === producto.categoriaId)?.nombre}
                      {producto.estacionId && ` · a ${nombreEstacion(producto.estacionId)}`}
                    </Text>
                  </div>
                  <Text fw={600}>{formatearPesos(producto.precio)}</Text>
                </Group>
                <Group gap="xs" mt="xs">
                  <Button
                    variant="default"
                    size="sm"
                    mih={44}
                    onClick={() => setDialogo({ tipo: 'producto', producto })}
                    aria-label={`Editar ${producto.nombre}`}
                  >
                    Editar
                  </Button>
                  <BotonAccion
                    accion={cambiarProductoActivo}
                    datos={
                      producto.activo ? { id: producto.id } : { id: producto.id, activo: 'on' }
                    }
                    etiqueta={producto.activo ? 'Desactivar' : 'Activar'}
                    aria-label={`${producto.activo ? 'Desactivar' : 'Activar'} ${producto.nombre}`}
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="categorias" pt="md">
          <Stack gap="sm">
            <Button size="sm" mih={44} onClick={() => setDialogo({ tipo: 'categoria' })}>
              Agregar categoría
            </Button>
            {categorias.map((categoria) => (
              <Card key={categoria.id} withBorder padding="sm">
                <Text fw={600}>{categoria.nombre}</Text>
                <Text size="sm" c="dimmed">
                  {reglaDe(categoria)}
                </Text>
                <Group gap="xs" mt="xs">
                  <Button
                    variant="default"
                    size="sm"
                    mih={44}
                    onClick={() => setDialogo({ tipo: 'categoria', categoria })}
                    aria-label={`Editar ${categoria.nombre}`}
                  >
                    Editar
                  </Button>
                  <BotonAccion
                    accion={eliminarCategoria}
                    datos={{ id: categoria.id }}
                    etiqueta="Eliminar"
                    color="red"
                    aria-label={`Eliminar ${categoria.nombre}`}
                    confirmar={`¿Eliminar la categoría ${categoria.nombre}?`}
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={dialogo?.tipo === 'categoria'}
        onClose={cerrar}
        title={
          dialogo?.tipo === 'categoria' && dialogo.categoria
            ? 'Editar categoría'
            : 'Agregar categoría'
        }
      >
        {dialogo?.tipo === 'categoria' && (
          <FormularioAccion
            accion={dialogo.categoria ? editarCategoria : crearCategoria}
            textoEnviar="Guardar"
            alTerminar={cerrar}
          >
            {dialogo.categoria && <input type="hidden" name="id" value={dialogo.categoria.id} />}
            <CamposCategoria categoria={dialogo.categoria} estaciones={estaciones} />
          </FormularioAccion>
        )}
      </Modal>

      <Modal
        opened={dialogo?.tipo === 'producto'}
        onClose={cerrar}
        title={
          dialogo?.tipo === 'producto' && dialogo.producto ? 'Editar producto' : 'Agregar producto'
        }
      >
        {dialogo?.tipo === 'producto' && (
          <FormularioAccion
            accion={dialogo.producto ? editarProducto : crearProducto}
            textoEnviar="Guardar"
            alTerminar={cerrar}
          >
            {dialogo.producto && <input type="hidden" name="id" value={dialogo.producto.id} />}
            <CamposProducto
              producto={dialogo.producto}
              categorias={categorias}
              estaciones={estaciones}
            />
          </FormularioAccion>
        )}
      </Modal>
    </Stack>
  );
}
