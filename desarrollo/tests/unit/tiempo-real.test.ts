import { afterEach, describe, expect, it, vi } from 'vitest';
import { consultarEstado } from '@/shared/puertos/tiempo-real';

afterEach(() => vi.unstubAllGlobals());

const responder = (status: number, cuerpo: unknown = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(cuerpo), { status })),
  );

describe('consulta del estado en vivo (ADR-007)', () => {
  it('devuelve los datos de la pantalla', async () => {
    responder(200, { listas: [1] });
    expect(await consultarEstado('/api/vivo/x')).toEqual({
      sesionVencida: false,
      datos: { listas: [1] },
    });
  });

  it('una sesión vencida o un turno cambiado se informa para recargar la página', async () => {
    responder(401);
    expect(await consultarEstado('/api/vivo/x')).toEqual({ sesionVencida: true });
    responder(403);
    expect(await consultarEstado('/api/vivo/x')).toEqual({ sesionVencida: true });
  });

  it('un error del servidor cuenta como falla', async () => {
    responder(500);
    await expect(consultarEstado('/api/vivo/x')).rejects.toThrow('Respuesta 500');
  });

  it('una petición colgada (mala señal) se corta y cuenta como falla, sin bloquear la siguiente', async () => {
    // Un fetch que nunca termina por sí solo: solo responde al corte.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_: string, opciones: RequestInit) =>
          new Promise((_resolver, rechazar) => {
            opciones.signal!.addEventListener('abort', () => rechazar(new Error('cortada')));
          }),
      ),
    );
    const inicio = Date.now();
    await expect(consultarEstado('/api/vivo/x', 50)).rejects.toThrow('cortada');
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});
