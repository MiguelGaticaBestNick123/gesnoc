import { hash, verify } from '@node-rs/argon2';

// Parámetros mínimos recomendados por OWASP para argon2id, el algoritmo por omisión de la biblioteca.
const parametros = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashearClave = (clave: string) => hash(clave, parametros);

export const verificarClave = (claveHash: string, clave: string) => verify(claveHash, clave);
