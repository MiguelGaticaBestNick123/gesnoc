import { describe, expect, it } from 'vitest';
import type { DatosProducto } from '@/modules/local/esquemas';
import * as ambientes from '@/modules/local/servicios/ambientes';
import * as catalogo from '@/modules/local/servicios/catalogo';
import { NoAutorizado } from '@/shared/errores';
import { administracion, conBaseVacia, conTurno } from './apoyo';

conBaseVacia();

const salon = { nombre: 'Salón', planoAncho: 900, planoAlto: 440 };
const barra = (ambienteId: number) => ({
  nombre: 'Barra Salón',
  tipo: 'barra' as const,
  ambienteId,
});
// La cocina es de todo el local: no tiene ambiente (decisión del Product Owner, 12 nov).
const cocina = { nombre: 'Cocina', tipo: 'cocina' as const, ambienteId: null };

const local = () => ambientes.listar(administracion);

async function crearSalon() {
  await ambientes.crear(administracion, salon);
  const {
    ambientes: [ambiente],
  } = await local();
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
    const {
      ambientes: [ambiente],
    } = await local();
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
    await ambientes.crearEstacion(administracion, barra(id));
    await expect(
      ambientes.crearEstacion(administracion, { ...barra(id), nombre: 'Otra barra' }),
    ).rejects.toThrow('Este ambiente ya tiene una barra');
  });

  it('CA3: la barra pertenece a su ambiente y la cocina a todo el local', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, barra(id));
    await ambientes.crearEstacion(administracion, cocina);
    const { ambientes: lista, cocinas } = await local();
    expect(lista[0]?.barra?.nombre).toBe('Barra Salón');
    expect(cocinas.map((e) => e.nombre)).toEqual(['Cocina']);
  });

  it('la base no acepta una cocina dentro de un ambiente ni una barra fuera de uno', async () => {
    const id = await crearSalon();
    await expect(
      ambientes.crearEstacion(administracion, { ...cocina, ambienteId: id }),
    ).rejects.toThrow('La barra va en un ambiente y la cocina en ninguno');
    await expect(
      ambientes.crearEstacion(administracion, { ...barra(id), ambienteId: null }),
    ).rejects.toThrow('La barra va en un ambiente y la cocina en ninguno');
  });

  it('una estación con productos no se puede eliminar', async () => {
    await ambientes.crearEstacion(administracion, cocina);
    const { cocinas } = await local();
    const estacionId = cocinas[0]!.id;
    await catalogo.crearCategoria(administracion, {
      nombre: 'Comida',
      reglaRuteo: 'fija',
      estacionId,
    });
    await expect(ambientes.eliminarEstacion(administracion, estacionId)).rejects.toThrow(
      'no se puede eliminar',
    );
  });

  it('una estación sin uso se elimina y se puede renombrar', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, barra(id));
    const {
      ambientes: [antes],
    } = await local();
    await ambientes.renombrarEstacion(administracion, antes!.barra!.id, 'Barra principal');
    expect((await local()).ambientes[0]?.barra?.nombre).toBe('Barra principal');
    await ambientes.eliminarEstacion(administracion, antes!.barra!.id);
    expect((await local()).ambientes[0]?.barra).toBeNull();
  });

  it('solo la administración configura el local (RNF-01)', async () => {
    await expect(ambientes.crear(conTurno('garzon'), salon)).rejects.toThrow(NoAutorizado);
    await expect(ambientes.crearEstacion(conTurno('barman'), barra(1))).rejects.toThrow(
      NoAutorizado,
    );
  });
});

describe('HU-06 categorías y productos', () => {
  it('CA1: una categoría fija apunta a una estación y un producto puede forzar otra (RN-10)', async () => {
    const id = await crearSalon();
    await ambientes.crearEstacion(administracion, cocina);
    await ambientes.crearEstacion(administracion, barra(id));
    const { ambientes: lista, cocinas } = await local();
    const barraSalon = lista[0]!.barra;
    const cocinaSalon = cocinas[0];

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
