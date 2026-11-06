import { Catalogo } from '@/modules/local/Catalogo';
import { listar } from '@/modules/local/servicios/catalogo';
import { exigirVista } from '@/shared/sesion';

export const metadata = { title: 'Catálogo · GesNoc' };

export default async function PaginaCatalogo() {
  const actor = await exigirVista('admin');
  return <Catalogo {...await listar(actor)} />;
}
