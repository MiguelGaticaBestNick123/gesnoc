import { notFound } from 'next/navigation';
import { MiClave } from '@/modules/acceso/MiClave';
import { roles } from '@/modules/acceso/roles';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Mi contraseña · GesNoc' };

const conClave = roles.filter((rol) => rol.secciones.some((s) => s.ruta === 'clave'));

export const dynamicParams = false;

export function generateStaticParams() {
  return conClave.map((rol) => ({ rol: rol.clave }));
}

// Brecha 5: cada persona cambia su propia contraseña, desde el menú de su rol.
export default async function PaginaMiClave({
  params,
}: Readonly<{ params: Promise<{ rol: string }> }>) {
  const { rol } = await params;
  const encontrado = conClave.find((r) => r.clave === rol);
  if (!encontrado) notFound();
  await exigirVista(encontrado.clave);
  return <MiClave />;
}
