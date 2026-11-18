import type { ClaveRol } from './roles';

/**
 * La ayuda «?» de cada rol: lo que hay que saber para usar la pantalla esa noche, en pocas líneas
 * (RNF-09). Se escribe como se habla en el local.
 */
export const ayudaPorRol: Record<ClaveRol, string[]> = {
  admin: [
    'Antes de la noche: prográmala en «Calendario de noches», con su premio y sus listas, y asigna los turnos.',
    'Al empezar: abre la noche con el fondo de caja en «Noche en curso». Sin noche abierta nadie opera.',
    'Durante la noche, «Resumen» e «Indicadores» se actualizan solos, y «Bitácora» dice quién hizo qué.',
    'El efectivo que cobran los garzones se confirma en «Confirmar efectivo».',
    'Para cerrar: confirma el efectivo, cierra las cuentas con saldo y cuenta la caja; si no cuadra, explica la diferencia.',
  ],
  garzon: [
    'Toca una mesa libre para abrir su cuenta; una ocupada, para pedir, ver el detalle o cobrar.',
    'Arma el pedido con el buscador o las categorías. Si lleva comida, indica cuántas personas.',
    'Un aviso verde es un pedido listo para retirar; uno naranja, una mesa que te llama. Tócalos para atender.',
    'Si se corta la señal, el pedido queda guardado y se reenvía sin duplicarse.',
    'El efectivo que cobras queda «por entregar» hasta que la administración lo confirma.',
  ],
  barra: [
    'Aquí llegan solo los tragos de tu ambiente, del más antiguo al más nuevo.',
    'Pasados 10 minutos el pedido se pone amarillo, y pasados 20, rojo: atiende primero lo que más espera.',
    'Toca «Lista» cuando esté preparado: al garzón le llega el aviso.',
    'Una nota en rojo es una alergia.',
    'La pantalla no se apaga mientras esté abierta. Tócala una vez para activar el sonido.',
  ],
  cocina: [
    'Aquí llega la comida de todos los ambientes, con cuántas personas son.',
    'Pasados 10 minutos el pedido se pone amarillo, y pasados 20, rojo.',
    'Toca «Lista» cuando esté preparado: al garzón que lo pidió le llega el aviso.',
    'Una nota en rojo es una alergia: revísala antes de preparar.',
    'La pantalla no se apaga mientras esté abierta. Tócala una vez para activar el sonido.',
  ],
  guardia: [
    'Busca a cada persona por su RUT, o por su documento si es extranjera, antes de dejarla pasar.',
    'Elige cómo entra: EF (efectivo), RC (tarjeta), PN (paga después) o gratis si viene en una lista.',
    'Una persona entra una sola vez por noche: si ya entró, la pantalla te dice a qué hora y con qué ticket.',
    'Un aviso rojo o amarillo significa que tiene reportes. En «Historial y reportes» puedes ver el detalle o reportarla.',
    'El sorteo se hace en «Sorteo», entre los tickets pagados de la noche.',
  ],
  personal: [
    'Sin turno esta noche solo ves tu calendario.',
    'Marca los días que puedes trabajar: la administración arma los turnos con eso.',
    'Cuando te asignen un turno y se abra la noche, verás la pantalla de tu rol.',
  ],
};
