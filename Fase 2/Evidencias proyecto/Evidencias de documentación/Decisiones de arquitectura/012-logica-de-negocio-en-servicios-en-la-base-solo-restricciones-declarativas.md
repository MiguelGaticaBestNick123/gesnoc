# ADR-012: Lógica de negocio en servicios; en la base solo restricciones declarativas

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

La lógica en funciones SQL y triggers es difícil de probar con las herramientas del equipo y de trasladar a otro proveedor.

## Opciones consideradas

Funciones y triggers en PostgreSQL; servicios TypeScript con transacciones.

## Decisión

La lógica transaccional vive en servicios TypeScript probados con Vitest contra PostgreSQL real. La base garantiza lo que puede garantizar de forma declarativa (PK, FK, UNIQUE, CHECK e índices parciales) y no tiene triggers ni funciones de negocio.

## Consecuencias

Portabilidad total del esquema y una lógica que se puede probar con las herramientas del equipo. Las reglas entre filas (saldo, ruteo) dependen de que todo pase por los servicios: por eso la autorización y el acceso a datos están centralizados.
