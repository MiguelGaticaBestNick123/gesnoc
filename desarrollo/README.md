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
npm run dev                   # http://localhost:3000
```

`GET /api/salud` responde `{"estado":"ok"}` cuando la aplicación llega a la base.

## Comandos

| Comando                                                   | Para qué                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                                             | Servidor de desarrollo                                                         |
| `npm run build`                                           | Build de producción                                                            |
| `npm run lint` / `npm run typecheck`                      | ESLint / tipos de TypeScript                                                   |
| `npm run format`                                          | Formatear con Prettier                                                         |
| `npm test`                                                | Pruebas unitarias y de integración (la integración necesita la base levantada) |
| `npm run test:unit`                                       | Solo unitarias                                                                 |
| `npx vitest run tests/unit/dinero.test.ts -t "decimales"` | Un archivo o una sola prueba                                                   |
| `npm run test:e2e`                                        | Playwright (levanta el servidor solo)                                          |
| `npm run db:migrar`                                       | Aplicar migraciones pendientes                                                 |
| `npm run db:nueva -- nombre`                              | Crear una migración nueva en `db/migrations/`                                  |
| `npm run db:esquema`                                      | Regenerar los tipos de Drizzle desde la base migrada                           |

## Base de datos

- Todo el modelo vive en el esquema `gesnoc`. Dos roles: `gesnoc_migrador` (dueño del esquema,
  aplica migraciones) y `gesnoc_app` (la aplicación, solo datos y sin borrar la historia de dinero
  ni de la puerta). Los crea `db/roles.sql`.
- El SQL de `db/migrations/` es la fuente de verdad. Una migración ya fusionada en `main` no se
  edita: cada cambio es una migración nueva.
- `src/shared/db/esquema/` se genera con `npm run db:esquema`; no se edita a mano.

## Roles

La portada permite entrar como administración (`/admin`), garzón (`/garzon`), barra (`/barra`),
cocina (`/cocina`), guardia (`/guardia`) o sin turno (`/personal`), y abrir la carta del cliente
(`/carta/demo`). Los menús de cada rol están en `src/modules/acceso/roles.ts`; cada sección indica
las historias que la construyen y las que aún no existen se muestran en construcción. Las pantallas
usan datos del local de demostración, no necesitan base de datos y el rol todavía no restringe el
acceso (llega con el inicio de sesión, HU-01).

## Estructura

```
db/migrations/      migraciones SQL (dbmate)
src/app/            rutas por rol y la carta pública
src/modules/        un módulo por área: servicios (reglas) y repositorios (SQL)
src/shared/         base de datos, sesión, autorización y utilidades comunes
tests/              unit/, integracion/ (contra PostgreSQL 17) y e2e/ (Playwright)
```

## Forma de trabajo

- Una historia a la vez, en commits pequeños con Conventional Commits en español: `feat: ...`,
  `fix: ...`, `test: ...`.
- Cada push a `main` pasa por la integración continua; si falla, se corrige antes de seguir.
