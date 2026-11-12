import { notFound } from 'next/navigation';
import { roles } from '@/modules/acceso/roles';
import { PantallaTurnos } from '@/modules/noche/PantallaTurnos';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Mis turnos · GesNoc' };

const conTurnos = roles.filter((rol) => rol.secciones.some((s) => s.ruta === 'turnos'));

export const dynamicParams = false;

export function generateStaticParams() {
  return conTurnos.map((rol) => ({ rol: rol.clave }));
}

export default async function PaginaTurnos({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ rol: string }>; searchParams: Promise<{ mes?: string }> }>) {
  const { rol } = await params;
  const encontrado = conTurnos.find((r) => r.clave === rol);
  if (!encontrado) notFound();

  return (
    <PantallaTurnos
      actor={await exigirVista(encontrado.clave)}
      ruta={`/${rol}/turnos`}
      mes={(await searchParams).mes}
    />
  );
}
