# Backlog priorizado

Backlog del producto de GesNoc tal como se priorizó en el sprint 0 (informe de avance, capítulo 9),
con el estado final de cada historia al 19 de noviembre de 2026.

Cada integrante asignó a cada historia un valor de 1 a 10, según su valor para la operación de una
noche, si es necesaria para medir algún objetivo, cuántas historias dependen de ella y su riesgo
técnico. La suma de los dos votos es el valor final, de 2 a 20, y define la prioridad según el método
MoSCoW: Debe (16 o más), Debería (11 a 15), Podría (6 a 10) y No en esta versión (5 o menos). Los
puntos son puntos de historia.

## Épicas

| ID | Épica | Para qué | Objetivo | Historias |
|-|-|-|-|-|
| E1 | Acceso y personal | Que solo el personal autorizado entre al sistema y que cada persona acceda únicamente a las funciones de su turno. | OE4 | HU-01 a HU-03 |
| E2 | Local y catálogo | Configurar los ambientes, el mapa de mesas, las estaciones, el catálogo y el código QR de cada mesa. | OE1 | HU-04 a HU-07 |
| E3 | Noche y turnos | Programar las noches, reunir la disponibilidad, asignar los turnos y abrir y cerrar cada noche. | OE4, OE2 | HU-08 a HU-12 |
| E4 | Venta y preparación | Tomar los pedidos de cada cuenta y hacerlos llegar a la estación que los prepara, hasta su entrega. | OE1 | HU-13 a HU-23 |
| E5 | Cobro y caja | Cobrar las cuentas en uno o varios pagos y cuadrar el dinero de la noche. | OE2 | HU-24 a HU-29 |
| E6 | Portería, seguridad y sorteo | Controlar el ingreso, reconocer a los invitados, llevar el historial de reportes de cada cliente y sortear el premio de cada ambiente. | OE3 | HU-30 a HU-37 |
| E7 | Carta digital y atención al cliente | Que el cliente consulte la carta desde su mesa y llame al garzón, sin instalar una aplicación ni crear una cuenta. | OE1 | HU-38 a HU-41 |

## Backlog

| N.° | ID | Épica | Historia de usuario | Voto de Miguel | Voto de Maximiliano | Valor final | Prioridad | Pts. | Sprint planificado | Estado final |
|-|-|-|-|-|-|-|-|-|-|-|
| 1 | HU-01 | E1 | Iniciar sesión con acceso según el turno | 10 | 10 | 20 | Debe | 5 | S1 | Terminada |
| 2 | HU-06 | E2 | Administrar categorías y productos | 9 | 9 | 18 | Debe | 5 | S1 | Terminada |
| 3 | HU-04 | E2 | Configurar ambientes y estaciones | 9 | 9 | 18 | Debe | – | S1 | Terminada |
| 4 | HU-08 | E3 | Programar las noches de apertura | 8 | 7 | 15 | Debería | 5 | S1 | Terminada |
| 5 | HU-03 | E1 | Administrar las cuentas del personal | 8 | 8 | 16 | Debe | 8 | S1 | Terminada |
| 6 | HU-05 | E2 | Dibujar el mapa de mesas | 8 | 8 | 16 | Debe | 2 | S1 | Terminada |
| 7 | HU-02 | E1 | Cerrar sesión | 7 | 9 | 16 | Debe | 8 | S1 | Terminada |
| 8 | HU-16 | E4 | Enviar el pedido a cada estación | 10 | 9 | 19 | Debe | 8 | S2 | Terminada |
| 9 | HU-10 | E3 | Asignar rol y ambiente | 9 | 10 | 19 | Debe | 5 | S2 | Terminada |
| 10 | HU-14 | E4 | Abrir una cuenta con o sin mesa | 9 | 9 | 18 | Debe | 2 | S2 | Terminada |
| 11 | HU-11 | E3 | Abrir la noche con el fondo de caja | 9 | 9 | 18 | Debe | 5 | S2 | Terminada |
| 12 | HU-13 | E4 | Ver el mapa con el estado de las mesas | 9 | 9 | 18 | Debe | 3 | S2 | Terminada |
| 13 | HU-15 | E4 | Encontrar productos y armar el pedido | 9 | 9 | 18 | Debe | 5 | S2 | Terminada |
| 14 | HU-09 | E3 | Ver turnos y declarar disponibilidad | 8 | 8 | 16 | Debe | 5 | S2 | Terminada |
| 15 | HU-20 | E4 | Recibir el aviso de pedido listo | 10 | 10 | 20 | Debe | 8 | S3 | Terminada |
| 16 | HU-24 | E5 | Cobrar con medio de pago y propina | 10 | 10 | 20 | Debe | 5 | S3 | Terminada |
| 17 | HU-17 | E4 | Ver la cola de la barra | 9 | 9 | 18 | Debe | 3 | S3 | Terminada |
| 18 | HU-19 | E4 | Marcar una comanda como lista | 9 | 9 | 18 | Debe | 2 | S3 | Terminada |
| 19 | HU-26 | E5 | Confirmar el efectivo | 9 | 9 | 18 | Debe | 5 | S3 | Terminada |
| 20 | HU-25 | E5 | Dividir la cuenta | 8 | 8 | 16 | Debe | 3 | S3 | Terminada |
| 21 | HU-18 | E4 | Ver la cola de cocina | 8 | 8 | 16 | Debe | 2 | S3 | Terminada |
| 22 | HU-21 | E4 | Marcar una comanda como entregada | 7 | 8 | 15 | Debería | 3 | S3 | Terminada |
| 23 | HU-23 | E4 | Consultar el detalle de la cuenta | 7 | 7 | 14 | Debería | 8 | S3 | Terminada |
| 24 | HU-30 | E6 | Registrar la entrada con ticket | 9 | 8 | 17 | Debe | 5 | S4 | Terminada |
| 25 | HU-28 | E5 | Cuadrar el arqueo | 9 | 9 | 18 | Debe | 5 | S4 | Terminada |
| 26 | HU-12 | E3 | Cerrar la noche | 9 | 9 | 18 | Debe | 5 | S4 | Terminada |
| 27 | HU-37 | E6 | Realizar el sorteo | 8 | 8 | 16 | Debe | 3 | S4 | Terminada |
| 28 | HU-22 | E4 | Anular un ítem | 6 | 6 | 12 | Debería | 2 | S4 | Terminada |
| 29 | HU-27 | E5 | Cerrar una cuenta con saldo | 6 | 6 | 12 | Debería | 3 | S4 | Terminada |
| 30 | HU-32 | E6 | Ver el estado de la puerta | 6 | 6 | 12 | Debería | 5 | S4 | Terminada |
| 31 | HU-29 | E5 | Ver el resumen de la noche | 5 | 6 | 11 | Debería | 3 | S4 | Terminada |
| 32 | HU-31 | E6 | Escanear la cédula | 7 | 7 | 14 | Debería | 2 | S5 | Fuera de alcance (declarada) |
| 33 | HU-35 | E6 | Crear un reporte de cliente | 7 | 7 | 14 | Debería | 3 | S5 | Terminada |
| 34 | HU-34 | E6 | Administrar la lista de invitados | 6 | 6 | 12 | Debería | 3 | S5 | Terminada |
| 35 | HU-33 | E6 | Reconocer a los invitados en la puerta | 7 | 8 | 15 | Debería | 5 | S5 | Terminada |
| 36 | HU-36 | E6 | Consultar el historial del cliente | 6 | 7 | 13 | Debería | 3 | S5 | Terminada |
| 37 | HU-07 | E2 | Generar el código QR de cada mesa | 6 | 6 | 12 | Debería | 3 | S5 | Terminada |
| 38 | HU-38 | E7 | Ver la carta desde el código QR | 7 | 7 | 14 | Debería | 3 | S5 | Terminada |
| 39 | HU-39 | E7 | Llamar al garzón | 7 | 7 | 14 | Debería | 3 | S5 | Terminada |
| 40 | HU-40 | E7 | Atender los llamados | 7 | 7 | 14 | Debería | 3 | S5 | Terminada |
| 41 | HU-41 | E7 | Ver promociones en la carta | 2 | 2 | 4 | No en esta versión | 3 | – | No en esta versión |

La HU-04 quedó sin estimación en el informe de avance.

## Resultado

- **41 historias y 171 puntos.** 40 estaban planificadas para esta versión: la HU-41, ver
  promociones en la carta, quedó desde el sprint 0 para una versión posterior.
- **39 de las 40 terminadas.** Quedó fuera la HU-31, escanear la cédula, porque depende de la
  cámara de cada teléfono; se declaró. En la puerta, el RUT se digita y se valida su dígito
  verificador.
- **La construcción se concentró en las semanas 13 y 14**, después de que el equipo quedó en un
  integrante. El detalle está en la carta Gantt de la presentación y del informe final.

## Pedidos del Product Owner al probar el sistema (18 y 19 de noviembre)

Al probar el sistema publicado se agregaron ajustes que amplían historias existentes, sin cambiar los
objetivos:

| Pedido | Historias relacionadas |
|-|-|
| Listas de invitados de una noche, de varias o sin término (por ejemplo, «Clientes frecuentes») | HU-33, HU-34 |
| Rol habitual de cada persona y recomendación al asignar los turnos | HU-03, HU-10 |
| Chat del personal: un canal general y uno por rol | Función nueva |
| Historial de comandas para garzón, barra, cocina y administración | HU-17, HU-18 |
| Hora del pedido y garzón destacado en la barra y la cocina | HU-17, HU-18 |
| Promociones predeterminadas en la nota de la noche | HU-08 |
| Confirmaciones dentro de la aplicación, en vez de los avisos del navegador | Todas las pantallas |
| El garzón ordena las mesas de su ambiente al empezar el turno | HU-05, HU-13 |
