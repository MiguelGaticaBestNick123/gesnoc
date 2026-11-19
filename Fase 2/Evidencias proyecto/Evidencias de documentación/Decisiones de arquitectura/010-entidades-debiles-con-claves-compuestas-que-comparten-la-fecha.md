# ADR-010: Entidades débiles con claves compuestas que comparten la fecha

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

Una entidad débil no tiene identificador propio: se reconoce por la clave de su dueño. Además, hay reglas entre tablas (un pedido no puede ir a una cuenta de otra noche).

## Opciones consideradas

Id sustituto en todas las tablas y reglas en la aplicación; claves compuestas.

## Decisión

CUENTA, PEDIDO, COMANDA, DETALLE_PEDIDO y PAGO se identifican por la clave del dueño más un discriminador; ARQUEO, por ser 1:1, hereda solo la clave de su noche. Las FK compuestas comparten la columna `fecha`, lo que vuelve imposible mezclar noches.

## Consecuencias

Claves de hasta tres columnas en DETALLE_PEDIDO y COMANDA. Drizzle las maneja sin problema. Reglas que antes eran código pasan a ser restricciones verificadas (I-10, I-12, I-22).
