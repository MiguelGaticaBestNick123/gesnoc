import { z } from 'zod';

/** Dónde está la cuenta: en una mesa o, con el cliente de pie, en un ambiente con una referencia. */
export type UbicacionCuenta = { mesaId: number } | { ambienteId: number; referencia: string };

const id = (mensaje: string) => z.number(mensaje).int(mensaje).positive(mensaje);

export const datosAbrirCuenta = z
  .object({
    mesaId: id('Mesa no válida').optional(),
    ambienteId: id('Ambiente no válido').optional(),
    referencia: z.string().trim().max(60, 'La referencia admite hasta 60 caracteres').optional(),
  })
  .transform(({ mesaId, ambienteId, referencia }, contexto): UbicacionCuenta => {
    if (mesaId !== undefined) return { mesaId };
    // RN-07: sin mesa, la cuenta necesita su ambiente y una seña para ubicar al cliente.
    if (ambienteId === undefined || !referencia) {
      contexto.addIssue({
        code: 'custom',
        message: 'Escribe una referencia para ubicar al cliente, por ejemplo «polera roja»',
      });
      return z.NEVER;
    }
    return { ambienteId, referencia };
  });

export const conCuenta = z.object({ cuenta: id('Cuenta no válida') });

/** Una comanda se identifica por su pedido y la estación que la prepara. */
export const datosComanda = z.object({
  pedido: id('Pedido no válido'),
  estacionId: id('Estación no válida'),
});

export const tipoEstacion = z.enum(['barra', 'cocina'], 'Estación no válida');

export const datosPedido = z.object({
  cuenta: id('Cuenta no válida'),
  claveEnvio: z.uuid('La clave de envío no es válida'),
  personas: z
    .number()
    .int()
    .min(1, 'El número de personas debe ser al menos 1')
    .max(50, 'El número de personas admite hasta 50')
    .nullable(),
  lineas: z
    .array(
      z.object({
        productoId: id('Producto no válido'),
        cantidad: z
          .number()
          .int()
          .min(1, 'La cantidad debe ser al menos 1')
          .max(99, 'Hasta 99 unidades por ítem'),
        nota: z
          .string()
          .trim()
          .max(140, 'La nota admite hasta 140 caracteres')
          .transform((texto) => texto || null),
      }),
    )
    .min(1, 'El pedido está vacío')
    .max(50, 'Un pedido admite hasta 50 ítems'),
});
export type DatosPedido = z.output<typeof datosPedido>;
