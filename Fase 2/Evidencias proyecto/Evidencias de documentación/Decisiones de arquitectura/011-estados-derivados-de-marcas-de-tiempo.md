# ADR-011: Estados derivados de marcas de tiempo

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

Una columna de estado puede contradecir a las marcas de tiempo si una actualización modifica una y olvida la otra.

## Opciones consideradas

Columna `estado` en cada tabla; estado deducido de `abierta_en`, `cerrada_en`, `lista_en`, `entregada_en` y `confirmado_en`.

## Decisión

No se guardan columnas de estado. El estado se deduce de las marcas de tiempo, y los CHECK impiden combinaciones imposibles (entregada sin estar lista).

## Consecuencias

No hay estados que contradigan a los datos. Las consultas de «abiertas» usan índices parciales (`where cerrada_en is null`).
