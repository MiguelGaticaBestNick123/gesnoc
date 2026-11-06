import { describe, expect, it } from 'vitest';
import { datosPersonaNueva } from '@/modules/acceso/esquemas';
import { datosCategoria, datosEstacion, datosProducto } from '@/modules/local/esquemas';
import { datosApertura, datosAsignacion, datosNoche } from '@/modules/noche/esquemas';

const persona = { nombre: 'Ana', correo: 'ana@gesnoc.test', clave: 'clave-larga' };

describe('personal', () => {
  it('guarda el correo en minúsculas y sin espacios (HU-03 CA1)', () => {
    const { correo } = datosPersonaNueva.parse({ ...persona, correo: '  ANA@Gesnoc.TEST ' });
    expect(correo).toBe('ana@gesnoc.test');
  });

  it('exige una contraseña de al menos 8 caracteres', () => {
    expect(datosPersonaNueva.safeParse({ ...persona, clave: 'corta' }).success).toBe(false);
  });

  it('lee la casilla de administración', () => {
    expect(datosPersonaNueva.parse(persona).esAdministrador).toBe(false);
    expect(datosPersonaNueva.parse({ ...persona, esAdministrador: 'on' }).esAdministrador).toBe(
      true,
    );
  });
});

describe('catálogo', () => {
  const producto = { nombre: 'Mojito', precio: '6500', categoriaId: '1', estacionId: '0' };

  it('una estación es barra o cocina (HU-04 CA3)', () => {
    expect(datosEstacion.safeParse({ nombre: 'Patio', tipo: 'bodega' }).success).toBe(false);
  });

  it('la regla fija exige estación (RN-10)', () => {
    const sin = { nombre: 'Comida', reglaRuteo: 'fija', estacionId: '' };
    expect(datosCategoria.safeParse(sin).success).toBe(false);
    expect(datosCategoria.parse({ ...sin, estacionId: '3' }).estacionId).toBe(3);
  });

  it('la barra del ambiente no guarda estación aunque llegue una', () => {
    const datos = { nombre: 'Tragos', reglaRuteo: 'barra_ambiente', estacionId: '3' };
    expect(datosCategoria.parse(datos).estacionId).toBeNull();
  });

  it.each(['0', '-500', '1500.5', 'abc'])('rechaza el precio %s (RN-24)', (precio) => {
    expect(datosProducto.safeParse({ ...producto, precio }).success).toBe(false);
  });

  it('un producto sin estación sigue la regla de su categoría', () => {
    expect(datosProducto.parse(producto).estacionId).toBeNull();
    expect(datosProducto.parse({ ...producto, estacionId: '2' }).estacionId).toBe(2);
  });
});

describe('noche', () => {
  const noche = { fecha: '2026-11-13', nota: '', precioEntrada: '0' };

  it('la entrada puede ser gratis, nunca negativa (RN-24)', () => {
    expect(datosNoche.parse(noche).precioEntrada).toBe(0);
    expect(datosNoche.safeParse({ ...noche, precioEntrada: '-1' }).success).toBe(false);
  });

  it('una nota vacía no se guarda', () => {
    expect(datosNoche.parse(noche).nota).toBeNull();
  });

  it('rechaza una fecha que no existe', () => {
    expect(datosNoche.safeParse({ ...noche, fecha: '2026-02-30' }).success).toBe(false);
  });

  it('el fondo de caja puede ser cero, nunca negativo ni con decimales (RN-24)', () => {
    const apertura = { fecha: noche.fecha };
    expect(datosApertura.parse({ ...apertura, fondo: '0' }).fondo).toBe(0);
    expect(datosApertura.safeParse({ ...apertura, fondo: '-1' }).success).toBe(false);
    expect(datosApertura.safeParse({ ...apertura, fondo: '10.5' }).success).toBe(false);
  });

  it('el guardia no lleva ambiente y los demás roles sí (RN-04)', () => {
    const turno = { fecha: noche.fecha, usuarioId: '1' };
    expect(datosAsignacion.parse({ ...turno, rol: 'guardia', ambienteId: '1' }).ambienteId).toBe(
      null,
    );
    expect(datosAsignacion.safeParse({ ...turno, rol: 'garzon' }).success).toBe(false);
    expect(datosAsignacion.parse({ ...turno, rol: 'garzon', ambienteId: '1' }).ambienteId).toBe(1);
  });
});
