# ADR-005: Migraciones SQL escritas por el equipo (dbmate)

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

El DDL revisado debe llegar idéntico a la base. Un ORM que genera migraciones puede inventar objetos.

## Opciones consideradas

Migraciones generadas por drizzle-kit; SQL propio aplicado con dbmate; SQL propio con migraciones personalizadas de drizzle-kit.

## Decisión

SQL propio en `db/migrations/`, aplicado con dbmate (binario independiente, sin dependencia del ORM). Los tipos de Drizzle se obtienen por introspección (`drizzle-kit pull`). La tabla de control de dbmate vive en el esquema `migraciones`, fuera del modelo.

## Consecuencias

La única fuente de verdad es el SQL. Los nombres de migración con marca de tiempo evitan choques de numeración entre ramas; además, solo una persona crea migraciones por sprint.
