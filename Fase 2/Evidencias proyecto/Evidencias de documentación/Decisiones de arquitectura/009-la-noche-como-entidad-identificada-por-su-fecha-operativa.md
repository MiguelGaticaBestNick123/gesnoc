# ADR-009: La noche como entidad, identificada por su fecha operativa

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

La jornada cruza la medianoche. Calcular la «fecha operativa» con el reloj en cada pantalla produce discrepancias cerca del horario de corte.

## Opciones consideradas

Calcular la fecha con un corte horario en cada consulta; entidad NOCHE con id sustituto; entidad NOCHE con la fecha como clave natural.

## Decisión

NOCHE con PK `fecha`. La fecha se fija al programar la noche; la noche en curso es la que está abierta, no la que dice el reloj. Todas las tablas de operación heredan la columna `fecha`.

## Consecuencias

Desaparece el cálculo disperso. Las claves hijas son legibles («pedido 57 de la noche 2026-10-16»). Si se programa una noche con fecha equivocada, se elimina mientras no tenga operaciones.
