import { z } from 'zod';
import { CANALES } from './canales';

/** Un mensaje del chat, con la clave de envío que genera el teléfono para no duplicarlo (RN-13). */
export const datosMensaje = z.object({
  canal: z.enum(CANALES, 'Elige a quién va el mensaje'),
  texto: z
    .string('Escribe el mensaje')
    .trim()
    .min(1, 'Escribe el mensaje')
    .max(500, 'El mensaje admite hasta 500 caracteres'),
  claveEnvio: z.uuid('Clave de envío no válida'),
});
export type DatosMensaje = z.output<typeof datosMensaje>;
