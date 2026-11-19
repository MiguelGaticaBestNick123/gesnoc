# ADR-007: Tiempo real por sondeo detrás de un puerto

Estado: aceptada con ajuste (7 de noviembre de 2026; propuesta en septiembre de 2026)

## Contexto

Mesas y comandas deben verse actualizadas en otros teléfonos. Supabase Realtime queda fuera por ADR-003.

## Opciones consideradas

Sondeo cada 2–3 s; SSE con `LISTEN/NOTIFY` (requiere un proceso Node persistente); WebSockets de un tercero.

## Decisión

Puerto de tiempo real en `shared/puertos/tiempo-real.ts` (`useTiempoReal`) con una implementación por
sondeo cada 3 s a un route handler.

**Ajuste del 7 de noviembre:** el route handler devuelve el **estado completo** de la pantalla (las mesas
de un ambiente, la cola de una estación, los avisos de un garzón) y no solo los cambios desde la última
marca, como se propuso. Motivo: el modelo no tiene columnas de actualización y la regla ADR-011 deriva
los estados de marcas de tiempo, así que un cambio como una anulación no se detecta con seguridad por
fecha. La foto completa no pierde cambios, no necesita la ventana de solape ni descartar repetidos, y su
tamaño es de pocos KB.

## Consecuencias

Funciona en cualquier host, incluso con escalado a cero. Con 40 dispositivos son unas 13 peticiones
por segundo, cada una con consultas de milisegundos (medido con una noche de 300 pedidos). La consulta
se pausa con la pestaña oculta y se repite al volver o al recuperar la red. Las pantallas no conocen la
implementación: si la latencia no alcanza, se cambia el adaptador a SSE sin tocarlas.

Limitación: con el teléfono bloqueado el navegador detiene el sondeo, así que un aviso aparece al
volver a la aplicación. Las notificaciones push quedan fuera del alcance.
