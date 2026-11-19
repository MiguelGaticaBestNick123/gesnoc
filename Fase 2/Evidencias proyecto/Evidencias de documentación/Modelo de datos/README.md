# Modelo de datos

GesNoc guarda todo en PostgreSQL 17, en el esquema `gesnoc`.

- **La fuente de verdad son las migraciones**, en
  [desarrollo/db/migrations](<../../../../desarrollo/db/migrations/>). Se aplican en orden con
  dbmate, y una migración ya publicada no se edita: cada cambio entra como una migración nueva.
- **[ddl_gesnoc.sql](ddl_gesnoc.sql)** reúne el modelo físico en un solo archivo: tablas, claves,
  llaves foráneas, reglas CHECK, índices y los comentarios de cada tabla y columna, que hacen de
  diccionario de datos.
- **[Modelo en pgAdmin (extracto)](<Modelo en pgAdmin (extracto).png>)** es el diagrama hecho en
  pgAdmin, la herramienta oficial de PostgreSQL, a partir de la base real. Muestra el recorrido del
  pedido: cuenta, pedido, comanda, estación, producto y pago.
- **El modelo conceptual** (entidades, relaciones y vistas del modelo entidad-relación) está en el
  informe de avance.

## Migraciones

1. `20261015120000_modelo_inicial.sql`
1. `20261112120000_sillas_por_mesa.sql`
1. `20261112130000_cocina_sin_ambiente.sql`
1. `20261112140000_detalles_de_la_noche.sql`
1. `20261118120000_listas_con_vigencia.sql`
1. `20261119010000_rol_habitual.sql`
1. `20261119020000_mensajes.sql`

## Tablas por parte del sistema

La base tiene 27 tablas, 52 llaves foráneas y 86 reglas CHECK.

| Parte | Tablas |
|-|-|
| Personal | `usuario`, `sesion`, `mensaje` |
| Noches y turnos | `noche`, `disponibilidad`, `asignacion`, `evento`, `premio`, `lista`, `integrante`, `invitacion` |
| Local y carta | `ambiente`, `estacion`, `mesa`, `categoria`, `producto` |
| Pedidos | `cuenta`, `pedido`, `detalle_pedido`, `comanda`, `llamado` |
| Cobro y caja | `pago`, `arqueo` |
| Puerta y sorteo | `cliente`, `entrada`, `reporte`, `sorteo` |

## Lo que cuida la propia base

- **Sin repetir datos:** cada dato se guarda en un solo lugar (forma normal de Boyce-Codd).
- **Numeración por noche:** las cuentas, los pedidos y los llamados se identifican por la fecha de la
  noche más su número, que parte en 1 cada noche; los tickets de la puerta tampoco se repiten dentro
  de la noche. La base garantiza que esos números no se dupliquen, aunque dos personas guarden al
  mismo tiempo.
- **Índices únicos con condición:** una sola cuenta abierta por mesa, un llamado pendiente por mesa,
  una sola noche abierta y un número de mesa por ambiente entre las mesas activas.
- **Dos roles:** `gesnoc_migrador` es dueño del esquema y aplica las migraciones; `gesnoc_app`, el
  que usa la aplicación, no puede borrar ni modificar la historia del dinero y de la puerta (cuentas,
  pedidos, comandas, pagos, arqueos, entradas, sorteos, llamados, reportes y mensajes), salvo las
  columnas que registran eventos, como la hora en que una comanda queda lista.
- **Datos personales:** al cerrar la noche se anonimizan los clientes sin visitas en 12 meses, de
  acuerdo con la Ley N.° 21.719.
