import { describe, expect, it } from 'vitest';
import { canalesDe, noLeidos } from '@/modules/chat/canales';
import { datosMensaje } from '@/modules/chat/esquemas';

// Chat del personal (pedido del Product Owner, 18 nov).

describe('canales del chat', () => {
  it('el general y el del rol de la noche; la administración, todos; sin turno, ninguno', () => {
    expect(canalesDe({ esAdministrador: false, turno: { rol: 'barman' } })).toEqual([
      'general',
      'barman',
    ]);
    expect(canalesDe({ esAdministrador: true, turno: null })).toEqual([
      'general',
      'garzon',
      'barman',
      'cocinero',
      'guardia',
    ]);
    expect(canalesDe({ esAdministrador: false, turno: null })).toEqual([]);
  });

  it('cuenta lo que llegó después de lo visto, sin los mensajes propios', () => {
    const mensajes = [
      { numero: 1, canal: 'general' as const, autorId: 2 },
      { numero: 2, canal: 'general' as const, autorId: 7 },
      { numero: 3, canal: 'garzon' as const, autorId: 2 },
      { numero: 4, canal: 'general' as const, autorId: 3 },
    ];
    expect(noLeidos(mensajes, {}, 7)).toEqual({ general: 2, garzon: 1 });
    expect(noLeidos(mensajes, { general: 2, garzon: 3 }, 7)).toEqual({ general: 1 });
  });

  it('el mensaje no va vacío ni a un canal que no existe', () => {
    const base = { canal: 'general', claveEnvio: '7b2f8f8e-2a6f-4d7e-9a43-1b9f2c3d4e5f' };
    expect(datosMensaje.safeParse({ ...base, texto: '   ' }).error?.issues[0]?.message).toBe(
      'Escribe el mensaje',
    );
    expect(
      datosMensaje.safeParse({ ...base, canal: 'clientes', texto: 'Hola' }).error?.issues[0]
        ?.message,
    ).toBe('Elige a quién va el mensaje');
    expect(datosMensaje.parse({ ...base, texto: '  Hola  ' }).texto).toBe('Hola');
  });
});
