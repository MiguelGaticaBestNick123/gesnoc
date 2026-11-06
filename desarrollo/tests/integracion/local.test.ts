import { describe, expect, it } from 'vitest';
import type { DatosProducto } from '@/modules/local/esquemas';
import * as ambientes from '@/modules/local/servicios/ambientes';
import * as catalogo from '@/modules/local/servicios/catalogo';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, conTurno } from './apoyo';

conBaseVacia();

const salon = { nombre: 'Salón', planoAncho: 900, planoAlto: 440 };
const barra = { nombre: 'Barra Salón', tipo: 'barra' as const };
const cocina = { nombre: 'Cocina', tipo: 'cocina' as const };

async function crearSalon() {
  await ambientes.crear(administracion, salon);
  const [ambiente] = await ambientes.listar(administracion);
  return ambiente!.id;
}

async function crearCategoriaConProducto() {
  await catalogo.crearCategoria(administracion, {
    nombre: 'Tragos',
    reglaRuteo: 'barra_ambiente',
    estacionId: null,
  });
  const { categorias } = await catalogo.listar(administracion);
  const producto: DatosProducto = {
    nombre: 'Mojito',
    precio: 6500,
    categoriaId: categorias[0]!.id,
    estacionId: null,
  };
  await catalogo.crearProducto(administracion, producto);
  return producto;
}

describe('HU-04 ambientes y estaciones', () => {
  it('CA1: crea, edita y desactiva un ambiente', async () => {
    const id = await crearSalon();
    await ambientes.editar(administracion, id, { ...salon, nombre: 'Salón principal' });
    await ambientes.cambiarActivo(administracion, id, false);
    const [ambiente] = await ambientes.listar(administracion);
    expect(ambiente).toMatchObject({ nombre: 'Salón principal', activo: false });
  });

  it('el nombre del ambiente no se repite, sin distinguir mayúsculas', async () => {
    await crearSalon();
    await expect(ambientes.crear(administracion, { ...salon, nombre: 'SALÓN' })).rejects.toThrow(
      'Ya existe un ambiente con ese nombre',
    );
  });

  it('CA2: un ambiente tiene a lo más una barra (RN-27)', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, id, barra);
    await expect(
      ambientes.crearEstacion(administracion, id, { nombre: 'Otra barra', tipo: 'barra' }),
    ).rejects.toThrow('Este ambiente ya tiene una barra');
  });

  it('CA3: la estación pertenece a su ambiente y puede convivir una cocina con la barra', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, id, barra);
    await ambientes.crearEstacion(administracion, id, cocina);
    const [ambiente] = await ambientes.listar(administracion);
    expect(ambiente?.estaciones.map((e) => e.nombre)).toEqual(['Barra Salón', 'Cocina']);
  });

  it('una estación con productos no se puede eliminar', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, id, cocina);
    const [ambiente] = await ambientes.listar(administracion);
    const estacionId = ambiente!.estaciones[0]!.id;
    await catalogo.crearCategoria(administracion, {
      nombre: 'Comida',
      reglaRuteo: 'fija',
      estacionId,
    });
    await expect(ambientes.eliminarEstacion(administracion, estacionId)).rejects.toThrow(
      'no se puede eliminar',
    );
  });

  it('una estación sin uso se elimina', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, id, barra);
    const [ambiente] = await ambientes.listar(administracion);
    await ambientes.eliminarEstacion(administracion, ambiente!.estaciones[0]!.id);
    const [despues] = await ambientes.listar(administracion);
    expect(despues?.estaciones).toEqual([]);
  });

  it('solo la administración configura el local (RNF-01)', async () => {
    await expect(ambientes.crear(conTurno('garzon'), salon)).rejects.toThrow(NoAutorizado);
    await expect(ambientes.crearEstacion(conTurno('barman'), 1, barra)).rejects.toThrow(
      NoAutorizado,
    );
  });
});

describe('HU-06 categorías y productos', () => {
  it('CA1: una categoría fija apunta a una estación y un producto puede forzar otra (RN-10)', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, id, cocina);
    await ambientes.crearEstacion(administracion, id, barra);
    const [ambiente] = await ambientes.listar(administracion);
    const [barraSalon, cocinaSalon] = ambiente!.estaciones;

    await catalogo.crearCategoria(administracion, {
      nombre: 'Comida',
      reglaRuteo: 'fija',
      estacionId: cocinaSalon!.id,
    });
    const { categorias } = await catalogo.listar(administracion);
    await catalogo.crearProducto(administracion, {
      nombre: 'Maní',
      precio: 2000,
      categoriaId: categorias[0]!.id,
      estacionId: barraSalon!.id,
    });

    const { productos } = await catalogo.listar(administracion);
    expect(categorias[0]).toMatchObject({ reglaRuteo: 'fija', estacionId: cocinaSalon!.id });
    expect(productos[0]?.estacionId).toBe(barraSalon!.id);
  });

  it('la base no acepta una categoría fija sin estación', async () => {
    await expect(
      catalogo.crearCategoria(administracion, {
        nombre: 'Comida',
        reglaRuteo: 'fija',
        estacionId: null,
      }),
    ).rejects.toThrow();
  });

  it('CA2: la base no acepta un precio de cero (RN-24)', async () => {
    const producto = await crearCategoriaConProducto();
    await expect(
      catalogo.crearProducto(administracion, { ...producto, nombre: 'Gratis', precio: 0 }),
    ).rejects.toThrow();
  });

  it('el nombre del producto no se repite', async () => {
    const producto = await crearCategoriaConProducto();
    await expect(catalogo.crearProducto(administracion, producto)).rejects.toThrow(
      'Ya existe un producto con ese nombre',
    );
  });

  it('CA3: un producto se desactiva sin borrarse y su precio se puede editar', async () => {
    const producto = await crearCategoriaConProducto();
    const { productos } = await catalogo.listar(administracion);
    const id = productos[0]!.id;
    await catalogo.editarProducto(administracion, id, { ...producto, precio: 7000 });
    await catalogo.cambiarProductoActivo(administracion, id, false);

    const despues = await catalogo.listar(administracion);
    expect(despues.productos[0]).toMatchObject({ precio: 7000, activo: false });
  });

  it('una categoría con productos no se elimina', async () => {
    await crearCategoriaConProducto();
    const { categorias } = await catalogo.listar(administracion);
    await expect(catalogo.eliminarCategoria(administracion, categorias[0]!.id)).rejects.toThrow(
      'tiene productos',
    );
  });

  it('solo la administración cambia el catálogo (RNF-01)', async () => {
    const producto = await crearCategoriaConProducto();
    await expect(catalogo.crearProducto(conTurno('garzon'), producto)).rejects.toThrow(
      NoAutorizado,
    );
  });
});
