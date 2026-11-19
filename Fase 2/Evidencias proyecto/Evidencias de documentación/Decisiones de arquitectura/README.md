# Decisiones de arquitectura (ADR)

Cada decisión importante quedó escrita con su contexto, las opciones consideradas, la decisión y sus
consecuencias. Se propusieron en septiembre de 2026; este es su estado al 19 de noviembre de 2026.

| ADR | Decisión | Estado |
|-|-|-|
| [001](<001-monolito-modular-en-next-js.md>) | Monolito modular en Next.js | Aceptada |
| [002](<002-mantine-9-como-biblioteca-de-interfaz.md>) | Mantine 9 como biblioteca de interfaz | Aceptada |
| [003](<003-postgresql-17-portable-supabase-solo-como-host.md>) | PostgreSQL 17 portable; Supabase solo como host | Aceptada |
| [004](<004-esquema-propio-y-dos-roles-de-base-de-datos.md>) | Esquema propio y dos roles de base de datos | Aceptada |
| [005](<005-migraciones-sql-escritas-por-el-equipo-dbmate.md>) | Migraciones SQL escritas por el equipo (dbmate) | Aceptada |
| [006](<006-autenticacion-propia-usuario-sesion.md>) | Autenticación propia: usuario + sesión | Aceptada |
| [007](<007-tiempo-real-por-sondeo-detras-de-un-puerto.md>) | Tiempo real por sondeo detrás de un puerto | Aceptada con ajuste (7 de noviembre) |
| [008](<008-autorizacion-en-una-sola-capa.md>) | Autorización en una sola capa | Aceptada |
| [009](<009-la-noche-como-entidad-identificada-por-su-fecha-operativa.md>) | La noche como entidad, identificada por su fecha operativa | Aceptada |
| [010](<010-entidades-debiles-con-claves-compuestas-que-comparten-la-fecha.md>) | Entidades débiles con claves compuestas que comparten la fecha | Aceptada |
| [011](<011-estados-derivados-de-marcas-de-tiempo.md>) | Estados derivados de marcas de tiempo | Aceptada |
| [012](<012-logica-de-negocio-en-servicios-en-la-base-solo-restricciones-declarativas.md>) | Lógica de negocio en servicios; en la base solo restricciones declarativas | Aceptada |
| [013](<013-mapa-de-mesas-en-svg.md>) | Mapa de mesas en SVG (antes: react-konva) | Reemplazó a la propuesta original (react-konva) el 11 de noviembre |
| [014](<014-despliegue-en-contenedor-y-ci-contra-postgres-17.md>) | Despliegue en contenedor y CI contra postgres:17 | Aceptada |
| [015](<015-scrum-adaptado-al-equipo.md>) | Scrum adaptado al equipo | Aceptada; ajustada en noviembre a un integrante |
