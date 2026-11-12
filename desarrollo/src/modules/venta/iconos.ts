import { IconBuildingBank, IconCash, IconCreditCard, type Icon } from '@tabler/icons-react';
import type { MedioDePago } from './cuenta';

/** El ícono de cada medio de pago, el mismo en el cobro, el detalle y el efectivo por entregar. */
export const iconoDelMedio: Record<MedioDePago, Icon> = {
  efectivo: IconCash,
  tarjeta: IconCreditCard,
  transferencia: IconBuildingBank,
};
