# ADR-004: Esquema propio y dos roles de base de datos

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

Supabase crea esquemas propios (`auth`, `storage`, `realtime`). El modelo defendido debe ser inequívoco. Seguridad en la nube es eje del proyecto.

## Opciones consideradas

Tablas en `public` con un solo usuario dueño; esquema propio con roles separados.

## Decisión

Todo el modelo vive en el esquema `gesnoc`. `gesnoc_migrador` es dueño y ejecuta DDL; `gesnoc_app` solo tiene DML y no puede borrar la historia de dinero ni de la puerta.

## Consecuencias

El modelo revisado corresponde exactamente al esquema gesnoc. Un error o una inyección desde la aplicación no puede borrar la historia, alterar montos de pedidos, pagos o entradas ni cambiar la estructura: sobre la historia solo puede actualizar las columnas que registran eventos (validado en S-01 a S-17).
