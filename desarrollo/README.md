# GesNoc

Gestión nocturna para locales con varios ambientes: turnos del personal, pedidos y su preparación
en barra y cocina, cobros, cierre de caja, control de la puerta, sorteo de cada noche y carta digital
por código QR.

Proyecto APT, Capstone de Ingeniería en Informática, Duoc UC.

## Tecnologías

Next.js 16 (App Router, TypeScript estricto), Mantine 9, Drizzle ORM sobre PostgreSQL 17,
migraciones SQL con dbmate, Vitest y Playwright. Docker Compose para el ambiente local.

## Requisitos

- Node.js 24
- Docker Desktop (para la base de datos local)

## Primeros pasos

```bash
npm install
cp .env.example .env          # completar las claves
docker compose up -d db migrar  # PostgreSQL 17, roles y migraciones
npm run db:semilla            # local de demostración
npm run dev                   # http://localhost:3000
```

Las cuentas de demostración son `admin`, `garzon` (Salón), `garzon2` (Terraza), `barra` (Salón),
`barra2` (Terraza), `cocina`, `guardia`, `sinturno` y `apoyo` (las dos últimas sin turno), todas
`@gesnoc.test`, con la contraseña definida en `CLAVE_DEMO`. Las noches quedan programadas: para que
cada persona opere su rol, la administración debe abrir la noche.

`GET /api/salud` responde `{"estado":"ok"}` cuando la aplicación llega a la base.

## Comandos

| Comando                                                   | Para qué                                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                             | Servidor de desarrollo                                                                                                |
| `npm run build`                                           | Build de producción                                                                                                   |
| `npm run local`                                           | Compilar y servir como en producción (más rápido que `dev` en un disco lento; el teléfono entra con la IP del equipo) |
| `npm run lint` / `npm run typecheck`                      | ESLint / tipos de TypeScript                                                                                          |
| `npm run format`                                          | Formatear con Prettier                                                                                                |
| `npm test`                                                | Pruebas unitarias y de integración (usan la base `gesnoc_pruebas`)                                                    |
| `npm run test:unit`                                       | Solo unitarias                                                                                                        |
| `npx vitest run tests/unit/dinero.test.ts -t "decimales"` | Un archivo o una sola prueba                                                                                          |
| `npm run test:e2e`                                        | Playwright (levanta el servidor en :3100 contra `gesnoc_pruebas`)                                                     |
| `npm run db:migrar`                                       | Aplicar migraciones pendientes                                                                                        |
| `npm run db:nueva -- nombre`                              | Crear una migración nueva en `db/migrations/`                                                                         |
| `npm run db:semilla`                                      | Cargar el local de demostración si la base no tiene personal                                                          |
| `npm run db:reiniciar`                                    | Dejar la base local como recién sembrada (borra todo; solo en local)                                                  |
| `npm run host:preparar`                                   | Preparar la base del ambiente publicado desde `.env.host` (ver abajo)                                                 |
| `npm run host:migrar`                                     | Aplicar las migraciones nuevas al ambiente publicado                                                                  |
| `npm run db:esquema`                                      | Regenerar los tipos de Drizzle desde la base migrada                                                                  |

## Base de datos

- Todo el modelo vive en el esquema `gesnoc`. Dos roles: `gesnoc_migrador` (dueño del esquema,
  aplica migraciones) y `gesnoc_app` (la aplicación, solo datos y sin borrar la historia de dinero
  ni de la puerta). Los crea `db/roles.sql`.
- El SQL de `db/migrations/` es la fuente de verdad. Una migración ya fusionada en `main` no se
  edita: cada cambio es una migración nueva.
- `src/shared/db/esquema/` se genera con `npm run db:esquema`; no se edita a mano.
- Las pruebas crean y vacían su propia base, `gesnoc_pruebas`, y se niegan a correr contra un host
  que no sea local. Necesitan `CLAVE_POSTGRES` para crearla la primera vez.

## Acceso y roles

No hay registro público: las cuentas las crea la administración. Al entrar, cada persona llega a la
pantalla del rol que tiene en la noche abierta (RF-04): `/garzon`, `/barra`, `/cocina` o `/guardia`.
Sin turno solo ve su calendario en `/personal` (RN-05) y la administración (`/admin`) accede a todo.
La carta del cliente (`/carta/[token]`) es pública.

Los permisos se deciden en un solo lugar, `src/shared/autorizacion/`: cada servicio llama a `exigir`
y cada página a `exigirVista`. Los menús están en `src/modules/acceso/roles.ts`; las secciones que
aún no se construyen se muestran en construcción, y la pantalla de la puerta usa datos de
demostración hasta que llegue HU-30.

## Ambiente publicado

La base es un PostgreSQL 17 administrado (Supabase, solo como servidor de base de datos) y la
aplicación corre como imagen Docker en otro servicio, en la misma región.

1. Crear `desarrollo/.env.host` (no se sube) con una sola línea: `HOST_URL_ADMIN=` y la cadena de
   conexión del usuario administrador en el pooler en modo sesión.
2. `npm run host:preparar`: genera las claves que falten, crea los roles, aplica las migraciones,
   carga el local de demostración y deja `HOST_DATABASE_URL` en el mismo archivo. No muestra claves.
3. En el servicio de la aplicación, definir `DATABASE_URL` con el valor de `HOST_DATABASE_URL`.
4. Cada vez que haya una migración nueva, `npm run host:migrar` **antes** de subir el código que la
   usa: si no, la versión publicada consultaría columnas que su base todavía no tiene.

## Operación de la noche

Las pantallas de la noche se actualizan solas cada 3 segundos (`src/shared/puertos/tiempo-real.ts`,
ADR-007). Pedidos y cuentas se envían por rutas JSON (`src/app/api/`): un 4xx significa que no se
registró nada; ante un corte de red el teléfono reintenta con la misma clave de envío y el servidor
devuelve lo ya registrado (RN-13).

Toda operación de la noche corre dentro de `enLaNoche` (`src/modules/noche/servicios/noches.ts`),
que bloquea la noche en modo compartido y verifica que siga abierta: el cierre de la noche espera a
las operaciones en curso y las que llegan después se rechazan (RN-26).

Barra y cocina ven su cola en `/barra` y `/cocina`, con aviso sonoro al entrar una comanda (se
activa con el primer toque) y la pantalla siempre encendida, que requiere HTTPS.

El plano de mesas es un SVG (`src/modules/local/PlanoMesas.tsx`, ADR-013) que comparten el mapa del
garzón y el editor de la administración (`/admin/mapa`, HU-05). Se ajusta al ancho del teléfono, se
acerca y se abre a pantalla completa. La portada de la administración (`/admin`) muestra las cifras
reales de la noche, al día cada 3 segundos.

## Estructura

```
db/migrations/      migraciones SQL (dbmate)
db/seeds/           local de demostración con datos ficticios
src/app/            rutas por rol y la carta pública
src/modules/        un módulo por área: servicios (reglas) y repositorios (SQL)
src/shared/         base de datos, sesión, autorización y utilidades comunes
tests/              unit/, integracion/ (contra PostgreSQL 17) y e2e/ (Playwright)
```

## Forma de trabajo

- Una historia a la vez, en commits pequeños con Conventional Commits en español: `feat: ...`,
  `fix: ...`, `test: ...`.
- Cada push a `main` pasa por la integración continua; si falla, se corrige antes de seguir.
