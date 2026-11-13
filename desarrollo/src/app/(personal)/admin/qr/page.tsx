import { headers } from 'next/headers';
import { origenDe } from '@/modules/local/carta';
import { CodigosQr } from '@/modules/local/CodigosQr';
import { codigosDeMesas } from '@/modules/local/servicios/qr';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Códigos QR · GesNoc' };

// HU-07: el código QR de cada mesa, por ambiente.
export default async function PaginaCodigosQr({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ambiente?: string }> }>) {
  const actor = await exigirVista('admin');
  const { ambiente } = await searchParams;
  const datos = await codigosDeMesas(
    actor,
    origenDe(await headers()),
    Number(ambiente) || undefined,
  );
  return <CodigosQr datos={datos} />;
}
