import { describe, expect, it } from 'vitest';
import { datosMiClave } from '@/modules/acceso/esquemas';
import {
  cambiarMiClave,
  cerrarSesion,
  iniciarSesion,
} from '@/modules/acceso/servicios/autenticacion';
import * as personal from '@/modules/acceso/servicios/personal';
import { NoAutorizado } from '@/shared/errores';
import { actorDeToken, hashDeToken } from '@/shared/sesion/actor';
import { verificarClave } from '@/shared/sesion/clave';
import {
  administracion,
  CLAVE,
  conBaseVacia,
  consultar,
  conTurno,
  crearPersona,
  sinTurno,
} from './apoyo';

conBaseVacia();

const correo = 'persona@gesnoc.test';
const INCORRECTAS = 'Correo o contraseña incorrectos';
const BLOQUEADA = 'Cuenta bloqueada por 15 minutos tras varios intentos fallidos';

const claveDe = async (id: number) => {
  const [fila] = await consultar<{ clave_hash: string }[]>`
    select clave_hash from gesnoc.usuario where id = ${id}`;
  return fila!.clave_hash;
};

async function agotarIntentos() {
  for (let intento = 1; intento <= 4; intento++) {
    await expect(iniciarSesion(correo, 'equivocada')).rejects.toThrow(INCORRECTAS);
  }
  await expect(iniciarSesion(correo, 'equivocada')).rejects.toThrow(BLOQUEADA);
}

describe('HU-01 iniciar sesión', () => {
  it('con credenciales válidas abre una sesión', async () => {
    const id = await crearPersona(correo);
    const actor = await actorDeToken(await iniciarSesion(correo, CLAVE));
    expect(actor).toMatchObject({ id, esAdministrador: false, turno: null });
  });

  it('guarda solo el SHA-256 del token', async () => {
    await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    const [fila] = await consultar<{ token_hash: Buffer }[]>`select token_hash from gesnoc.sesion`;
    expect(Buffer.from(fila!.token_hash).equals(hashDeToken(token))).toBe(true);
  });

  it('no distingue una contraseña mala de un correo desconocido', async () => {
    await crearPersona(correo);
    await expect(iniciarSesion(correo, 'equivocada')).rejects.toThrow(INCORRECTAS);
    await expect(iniciarSesion('nadie@gesnoc.test', CLAVE)).rejects.toThrow(INCORRECTAS);
  });

  it('una cuenta desactivada no entra (RNF-01)', async () => {
    await crearPersona(correo, false);
    await expect(iniciarSesion(correo, CLAVE)).rejects.toThrow(INCORRECTAS);
  });

  it('CA2: tras cinco fallos seguidos la cuenta se bloquea 15 minutos, aun con la clave buena', async () => {
    await crearPersona(correo);
    await agotarIntentos();
    await expect(iniciarSesion(correo, CLAVE)).rejects.toThrow(BLOQUEADA);

    const [fila] = await consultar<{ minutos: number }[]>`
      select round(extract(epoch from bloqueado_hasta - now()) / 60)::int as minutos
      from gesnoc.usuario`;
    expect(fila!.minutos).toBe(15);
  });

  it('vencido el bloqueo se puede volver a entrar', async () => {
    await crearPersona(correo);
    await agotarIntentos();
    await consultar`update gesnoc.usuario set bloqueado_hasta = now() - interval '1 second'`;
    expect(await iniciarSesion(correo, CLAVE)).toBeTruthy();
  });

  it('entrar reinicia la cuenta de intentos: deben ser seguidos', async () => {
    await crearPersona(correo);
    for (let ronda = 1; ronda <= 2; ronda++) {
      for (let intento = 1; intento <= 3; intento++) {
        await expect(iniciarSesion(correo, 'equivocada')).rejects.toThrow(INCORRECTAS);
      }
      await iniciarSesion(correo, CLAVE);
    }
  });
});

describe('el rol sale del turno de la noche abierta (RF-04)', () => {
  const fecha = '2026-11-06';

  async function conAsignacion(usuario: number, abierta: boolean) {
    const [ambiente] = await consultar<{ id: number }[]>`
      insert into gesnoc.ambiente (nombre, plano_ancho, plano_alto)
      values ('Salón', 900, 400) returning id`;
    await consultar`
      insert into gesnoc.noche (fecha, precio_entrada, abierta_en)
      values (${fecha}, 0, ${abierta ? new Date() : null})`;
    await consultar`
      insert into gesnoc.asignacion (fecha, usuario_id, rol, ambiente_id)
      values (${fecha}, ${usuario}, 'garzon', ${ambiente!.id})`;
    return ambiente!.id;
  }

  it('con turno en la noche abierta, la persona opera ese rol', async () => {
    const id = await crearPersona(correo);
    const ambienteId = await conAsignacion(id, true);
    const actor = await actorDeToken(await iniciarSesion(correo, CLAVE));
    expect(actor?.turno).toEqual({ fecha, rol: 'garzon', ambienteId });
  });

  it('un turno de una noche sin abrir todavía no da acceso (RN-05)', async () => {
    const id = await crearPersona(correo);
    await conAsignacion(id, false);
    const actor = await actorDeToken(await iniciarSesion(correo, CLAVE));
    expect(actor?.turno).toBeNull();
  });
});

describe('HU-02 cerrar sesión', () => {
  it('CA1: la sesión queda invalidada aunque se conserve la cookie', async () => {
    await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    await cerrarSesion(token);
    expect(await actorDeToken(token)).toBeNull();
  });

  it('CA2: la sesión vence a las 12 horas', async () => {
    await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    const [fila] = await consultar<{ horas: number }[]>`
      select round(extract(epoch from expira_en - now()) / 3600)::int as horas from gesnoc.sesion`;
    expect(fila!.horas).toBe(12);

    await consultar`update gesnoc.sesion set expira_en = now() - interval '1 second'`;
    expect(await actorDeToken(token)).toBeNull();
  });

  it('un token inventado no abre nada', async () => {
    expect(await actorDeToken('token-inventado')).toBeNull();
  });
});

describe('HU-03 administrar el personal', () => {
  const nueva = {
    nombre: 'Ana Rojas',
    correo: 'ana@gesnoc.test',
    clave: 'clave-inicial',
    esAdministrador: false,
  };

  it('CA1: el correo no se repite', async () => {
    await personal.crear(administracion, nueva);
    await expect(personal.crear(administracion, nueva)).rejects.toThrow(
      'Ya existe una cuenta con ese correo',
    );
  });

  it('CA3: la contraseña se almacena con argon2id y no se expone', async () => {
    await personal.crear(administracion, nueva);
    const [persona] = await personal.listar(administracion);
    expect(persona).not.toHaveProperty('claveHash');

    const hash = await claveDe(persona!.id);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(nueva.clave);
    expect(await iniciarSesion(nueva.correo, nueva.clave)).toBeTruthy();
  });

  it('CA2: al desactivar una cuenta sus sesiones dejan de funcionar de inmediato', async () => {
    const id = await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    await personal.cambiarActivo(administracion, id, false);
    expect(await actorDeToken(token)).toBeNull();
    await expect(iniciarSesion(correo, CLAVE)).rejects.toThrow(INCORRECTAS);
  });

  it('reactivar una cuenta no revive las sesiones que tenía', async () => {
    const id = await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    await personal.cambiarActivo(administracion, id, false);
    await personal.cambiarActivo(administracion, id, true);
    expect(await actorDeToken(token)).toBeNull();
  });

  it('se puede reactivar una cuenta', async () => {
    const id = await crearPersona(correo, false);
    await personal.cambiarActivo(administracion, id, true);
    expect(await iniciarSesion(correo, CLAVE)).toBeTruthy();
  });

  it('restablecer la contraseña desbloquea la cuenta y cierra sus sesiones', async () => {
    const id = await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    await agotarIntentos();

    await personal.restablecerClave(administracion, id, 'clave-nueva-1');
    expect(await actorDeToken(token)).toBeNull();
    expect(await verificarClave(await claveDe(id), 'clave-nueva-1')).toBe(true);
    expect(await iniciarSesion(correo, 'clave-nueva-1')).toBeTruthy();
  });

  it('editar no permite tomar el correo de otra persona', async () => {
    await crearPersona(correo);
    const otra = await crearPersona('otra@gesnoc.test');
    await expect(
      personal.editar(administracion, otra, {
        nombre: 'Otra',
        correo,
        esAdministrador: false,
      }),
    ).rejects.toThrow('Ya existe una cuenta con ese correo');
  });

  it('nadie se quita su propio acceso de administración', async () => {
    const id = await crearPersona(correo);
    const yo = { ...administracion, id };
    await expect(personal.cambiarActivo(yo, id, false)).rejects.toThrow('propia cuenta');
    await expect(
      personal.editar(yo, id, { nombre: 'Yo', correo, esAdministrador: false }),
    ).rejects.toThrow('propio acceso');
  });

  it('solo la administración administra el personal (RNF-01)', async () => {
    const id = await crearPersona(correo);
    for (const actor of [sinTurno(), conTurno('garzon'), conTurno('guardia')]) {
      await expect(personal.listar(actor)).rejects.toThrow(NoAutorizado);
      await expect(personal.crear(actor, nueva)).rejects.toThrow(NoAutorizado);
      await expect(personal.cambiarActivo(actor, id, false)).rejects.toThrow(NoAutorizado);
      await expect(personal.restablecerClave(actor, id, 'clave-nueva-1')).rejects.toThrow(
        NoAutorizado,
      );
    }
  });
});

describe('brecha 5: cada persona cambia su propia contraseña', () => {
  const NUEVA = 'otra-clave-propia';
  const cambio = (actual: string, nueva = NUEVA) => ({ actual, nueva, repetida: nueva });

  it('con la actual correcta la cambia, cierra las demás sesiones y conserva la propia', async () => {
    await crearPersona(correo);
    const enEste = await iniciarSesion(correo, CLAVE);
    const enOtro = await iniciarSesion(correo, CLAVE);
    const actor = (await actorDeToken(enEste))!;

    await cambiarMiClave(actor, enEste, cambio(CLAVE));

    expect(await actorDeToken(enEste)).toMatchObject({ id: actor.id });
    expect(await actorDeToken(enOtro)).toBeNull();
    await expect(iniciarSesion(correo, CLAVE)).rejects.toThrow(INCORRECTAS);
    expect(await actorDeToken(await iniciarSesion(correo, NUEVA))).toMatchObject({ id: actor.id });
  });

  it('con la actual equivocada no cambia nada, y los errores cuentan para el bloqueo', async () => {
    const id = await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    const actor = (await actorDeToken(token))!;
    const antes = await claveDe(id);

    for (let intento = 1; intento <= 4; intento++) {
      await expect(cambiarMiClave(actor, token, cambio('equivocada'))).rejects.toThrow(
        'La contraseña actual no es correcta',
      );
    }
    await expect(cambiarMiClave(actor, token, cambio('equivocada'))).rejects.toThrow(BLOQUEADA);
    // Bloqueada, ni la actual correcta sirve hasta que pase el bloqueo.
    await expect(cambiarMiClave(actor, token, cambio(CLAVE))).rejects.toThrow(BLOQUEADA);
    expect(await claveDe(id)).toBe(antes);
  });

  it('la nueva se repite igual, cumple el mínimo y es distinta de la actual', () => {
    expect(() => datosMiClave.parse({ actual: CLAVE, nueva: NUEVA, repetida: 'otra' })).toThrow(
      'no coincide al repetirla',
    );
    expect(() => datosMiClave.parse(cambio(CLAVE, 'corta'))).toThrow('al menos 8 caracteres');
    expect(() => datosMiClave.parse(cambio(CLAVE, CLAVE))).toThrow('distinta de la actual');
  });

  it('la administración no la ve: solo guarda el hash', async () => {
    const id = await crearPersona(correo);
    const token = await iniciarSesion(correo, CLAVE);
    await cambiarMiClave((await actorDeToken(token))!, token, cambio(CLAVE));
    const guardada = await claveDe(id);
    expect(guardada).not.toContain(NUEVA);
    expect(await verificarClave(guardada, NUEVA)).toBe(true);
  });
});
