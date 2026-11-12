import { z } from 'zod';
import { fecha, identificador, pesos } from '@/shared/esquemas';

/** HU-26: los pagos exactos que la administración vio en pantalla (cuenta y número de pago). */
export const datosConfirmacion = z.object({
  pagos: z
    .string()
    .transform((texto, contexto) => {
      try {
        return JSON.parse(texto) as unknown;
      } catch {
        contexto.addIssue({ code: 'custom', message: 'Pagos no válidos' });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(
          z.object({ cuenta: z.number().int().positive(), numero: z.number().int().positive() }),
        )
        .min(1, 'No hay pagos para confirmar')
        .max(500),
    ),
});

export const datosCierreDeCuenta = z.object({ numero: identificador });

/** HU-28: el conteo de la caja; la nota se exige en el servidor si hay diferencia (RN-20). */
export const datosConteo = z.object({
  contado: pesos('El efectivo contado debe ser un monto entero, cero o más'),
  nota: z
    .string()
    .trim()
    .max(500, 'La nota admite hasta 500 caracteres')
    .optional()
    .transform((nota) => nota || null),
});

export const datosCierreDeNoche = z.object({ fecha });
