// Ajusta lo que genera `drizzle-kit pull` para que el resultado sea repetible:
// drizzle-kit 0.31 no reconoce bytea (sesion.token_hash) y agrega el sufijo del
// esquema a cada tabla. El SQL que también genera no se usa: las migraciones son de dbmate.
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = 'src/shared/db/esquema';

for (const archivo of readdirSync(carpeta)) {
  if (archivo.endsWith('.sql') || archivo === 'meta') {
    rmSync(join(carpeta, archivo), { recursive: true });
  }
}

const ajustar = (archivo, cambiar) => {
  const ruta = join(carpeta, archivo);
  writeFileSync(ruta, cambiar(readFileSync(ruta, 'utf8')));
};

// Según la base contra la que corre, drizzle-kit nombra las secuencias con o sin el esquema; sin él,
// el resultado no depende de la base.
const sinSufijo = (texto) =>
  texto.replace(/(\w+?)InGesnoc/g, '$1').replace(/(['"])gesnoc\.(\w+_seq)\1/g, '$1$2$1');

ajustar('schema.ts', (texto) => {
  const conBytea = texto.replace(
    /\/\/ TODO: failed to parse database type 'bytea'\s*\n(\s*)(\w+): unknown\(/g,
    '$1$2: bytea(',
  );
  if (/unknown\(|TODO/.test(conBytea)) {
    throw new Error('drizzle-kit dejó tipos sin reconocer en schema.ts: revisar a mano');
  }
  const encabezado =
    'import { customType } from "drizzle-orm/pg-core";\n\n' +
    'const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });\n';
  const primeraLineaVacia = conBytea.indexOf('\n\n');
  return sinSufijo(
    conBytea.slice(0, primeraLineaVacia + 1) + encabezado + conBytea.slice(primeraLineaVacia + 1),
  );
});

ajustar('relations.ts', sinSufijo);
