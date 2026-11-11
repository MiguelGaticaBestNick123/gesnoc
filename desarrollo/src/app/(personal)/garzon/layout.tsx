import { AvisosGarzon } from '@/modules/venta/Comandas';
import { misComandas } from '@/modules/venta/servicios/colas';
import { puede } from '@/shared/autorizacion';
import { actorActual } from '@/shared/sesion';

// HU-20: el aviso de comanda lista acompaña al garzón en todas sus pantallas. El layout se mantiene
// al navegar entre ellas, así que el aviso no se pierde ni vuelve a sonar.
export default async function LayoutGarzon({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await actorActual();
  const comandas = actor && puede(actor, 'garzon') ? await misComandas(actor) : null;
  return (
    <>
      {children}
      {comandas && <AvisosGarzon inicial={comandas} />}
    </>
  );
}
