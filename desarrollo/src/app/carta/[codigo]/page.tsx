import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CartaDeMesa } from '@/modules/local/CartaDeMesa';
import { cartaDeMesa } from '@/modules/local/servicios/carta';

// Cada visita lee el catálogo y el código vigentes: si la administración desactiva un producto o
// regenera el QR (RN-28), la siguiente carga ya lo refleja.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Carta',
  // La carta de una mesa es pública por diseño, pero no tiene por qué aparecer en un buscador.
  robots: { index: false, follow: false },
};

// HU-38: carta pública de cada mesa. Se abre con el código QR, sin sesión.
export default async function PaginaCarta({
  params,
}: Readonly<{ params: Promise<{ codigo: string }> }>) {
  const { codigo } = await params;
  const carta = await cartaDeMesa(codigo);
  if (!carta) notFound();
  return <CartaDeMesa codigo={codigo} carta={carta} />;
}
