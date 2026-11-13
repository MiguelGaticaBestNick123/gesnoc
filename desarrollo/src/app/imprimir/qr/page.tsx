import { headers } from 'next/headers';
import { origenDe } from '@/modules/local/carta';
import { HojaDeCodigos } from '@/modules/local/HojaDeCodigos';
import { codigosDeMesas } from '@/modules/local/servicios/qr';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Imprimir códigos QR · GesNoc' };

// HU-07 CA3: la hoja para imprimir va fuera del marco de la aplicación (sin menú ni barra superior).
export default async function PaginaImprimirCodigos({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ambiente?: string }> }>) {
  const actor = await exigirVista('admin');
  const { ambiente } = await searchParams;
  const datos = await codigosDeMesas(
    actor,
    origenDe(await headers()),
    Number(ambiente) || undefined,
  );
  return <HojaDeCodigos datos={datos} />;
}
