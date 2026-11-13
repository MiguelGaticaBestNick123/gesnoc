import { NextResponse } from 'next/server';
import { origenDe } from '@/modules/local/carta';
import { archivoDelCodigo } from '@/modules/local/servicios/qr';
import { ErrorDeNegocio, NoAutorizado } from '@/shared/errores';
import { actorActual } from '@/shared/sesion';

// HU-07 CA3: descarga el código QR de una mesa como SVG, para imprimirlo a cualquier tamaño.
export async function GET(peticion: Request, { params }: { params: Promise<{ mesa: string }> }) {
  const actor = await actorActual();
  if (!actor) return NextResponse.redirect(new URL('/ingresar', peticion.url));
  const mesaId = Number((await params).mesa);
  if (!Number.isSafeInteger(mesaId) || mesaId <= 0) {
    return new NextResponse('Mesa no válida', { status: 404 });
  }
  try {
    const { nombre, svg } = await archivoDelCodigo(actor, origenDe(peticion.headers), mesaId);
    return new NextResponse(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-disposition': `attachment; filename="${nombre}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (falla) {
    if (falla instanceof NoAutorizado) return new NextResponse(falla.message, { status: 403 });
    if (falla instanceof ErrorDeNegocio) return new NextResponse(falla.message, { status: 404 });
    throw falla;
  }
}
