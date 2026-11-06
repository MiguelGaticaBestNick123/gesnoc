import { notFound } from 'next/navigation';
import { roles } from '@/modules/acceso/roles';
import { EnConstruccion } from '@/shared/ui/EnConstruccion';

const secciones = roles.flatMap((rol) =>
  rol.secciones.filter((s) => s.ruta && !s.destino).map((seccion) => ({ rol, seccion })),
);

export const dynamicParams = false;

export function generateStaticParams() {
  return secciones.map(({ rol, seccion }) => ({ rol: rol.clave, seccion: seccion.ruta }));
}

export default async function PaginaSeccion({
  params,
}: Readonly<{ params: Promise<{ rol: string; seccion: string }> }>) {
  const { rol, seccion } = await params;
  const encontrada = secciones.find((s) => s.rol.clave === rol && s.seccion.ruta === seccion);
  if (!encontrada) notFound();

  return (
    <EnConstruccion
      titulo={encontrada.seccion.etiqueta}
      descripcion={encontrada.seccion.descripcion}
      historias={encontrada.seccion.historias}
    />
  );
}
