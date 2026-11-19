# ADR-008: Autorización en una sola capa

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

Verificar permisos en varias capas (vista, acción y base de datos) hace difícil saber cuál decide y obliga a mantener tres versiones de la misma regla.

## Opciones consideradas

Autorización en la base (RLS); en cada acción; en una capa de servicio única.

## Decisión

Un servicio `Autorizacion.exigir(actor, permiso, recurso)` que toda acción invoca. El actor se arma con la sesión, `es_administrador` y la asignación de la noche abierta.

## Consecuencias

Un solo lugar que revisar y probar (matriz de permisos). La base sigue protegiéndose con restricciones y con el rol de mínimo privilegio, pero no decide permisos de negocio.
