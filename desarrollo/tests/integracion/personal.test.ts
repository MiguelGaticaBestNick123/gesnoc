import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { iniciarSesion } from '@/modules/acceso/servicios/autenticacion';
import * as personal from '@/modules/acceso/servicios/personal';
import { ordenarParaRol } from '@/modules/noche/recomendacion';
import { pantallaAsignacion } from '@/modules/noche/servicios/turnos';
import { actorDeToken } from '@/shared/sesion/actor';
import { correoDe, sembrar } from '../../db/seeds/demostracion';
import { aplicarPersonal, personalDelLocal } from '../../db/seeds/personal';
import { administracion, CLAVE, conBaseVacia, consultar, fijarReloj, relojReal } from './apoyo';

// El personal del local y su rol habitual (pedido del Product Owner, 18 nov).

conBaseVacia();
const hoy = '2026-11-07';
beforeAll(() => fijarReloj(hoy));
afterAll(relojReal);

describe('personal del local y rol habitual', () => {
  it('deja activas solo sus cuentas, con su rol habitual, y desactiva las demás', async () => {
    await sembrar(consultar, CLAVE, hoy);
    const tokenDeDiego = await iniciarSesion(correoDe('garzon'), CLAVE);

    const { activas, desactivadas } = await aplicarPersonal(consultar, CLAVE);
    expect(activas).toHaveLength(11);
    expect(desactivadas).toHaveLength(9);
    // Las cuentas anteriores quedan sin sesión y sin turnos futuros; la historia se conserva.
    expect(await actorDeToken(tokenDeDiego)).toBeNull();
    const [futuros] = await consultar<{ n: number }[]>`
      select count(*)::int as n from gesnoc.asignacion a
      join gesnoc.usuario u on u.id = a.usuario_id
      join gesnoc.noche n on n.fecha = a.fecha
      where not u.activo and n.abierta_en is null`;
    expect(futuros!.n).toBe(0);
    const [pasados] = await consultar<{ n: number }[]>`
      select count(*)::int as n from gesnoc.asignacion a
      join gesnoc.usuario u on u.id = a.usuario_id where not u.activo`;
    expect(pasados!.n).toBeGreaterThan(0);

    const cuentas = await personal.listar(administracion);
    const activa = (correo: string) => cuentas.find((c) => c.correo === correo)!;
    expect(activa('lorena@gesnoc.test')).toMatchObject({ esAdministrador: true, activo: true });
    expect(activa('matias@gesnoc.test')).toMatchObject({
      nombre: 'Matías',
      principal: 'barman',
      alternativo: 'garzon',
    });
    expect(activa('macarena@gesnoc.test')).toMatchObject({ principal: 'guardia' });
    expect(await iniciarSesion('cote@gesnoc.test', CLAVE)).toBeTruthy();
  });

  it('volver a aplicarlo no cambia la contraseña que alguien ya cambió', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await aplicarPersonal(consultar, CLAVE);
    const [cote] = await consultar<{ id: number }[]>`
      select id from gesnoc.usuario where correo = 'cote@gesnoc.test'`;
    await personal.restablecerClave(administracion, cote!.id, 'clave-de-cote-1');

    const { desactivadas } = await aplicarPersonal(consultar, 'otra-clave-de-demo');
    expect(desactivadas).toEqual([]);
    expect(await iniciarSesion('cote@gesnoc.test', 'clave-de-cote-1')).toBeTruthy();
  });

  it('la asignación recomienda por rol habitual y alternativo, sin la administración', async () => {
    await sembrar(consultar, CLAVE, hoy);
    await aplicarPersonal(consultar, CLAVE);
    const { dotacion } = await pantallaAsignacion(administracion, hoy);
    expect(dotacion.map((p) => p.nombre)).not.toContain('Lorena');
    expect(dotacion).toHaveLength(personalDelLocal.length - 1);

    // Barra: primero quienes la tienen como rol habitual, después Geo, que también la hace.
    const barra = ordenarParaRol(dotacion, 'barman');
    expect(barra.habituales.map((p) => p.nombre)).toEqual(['Matías', 'Pato', 'Geo']);
    const garzon = ordenarParaRol(dotacion, 'garzon');
    expect(garzon.habituales.map((p) => p.nombre)).toEqual([
      'Cote',
      'Geo',
      'Passi',
      'Scar',
      'Vary',
      'Matías',
    ]);
    expect(ordenarParaRol(dotacion, 'guardia').habituales).toHaveLength(3);
    expect(ordenarParaRol(dotacion, 'cocinero').habituales).toEqual([]);
  });
});
