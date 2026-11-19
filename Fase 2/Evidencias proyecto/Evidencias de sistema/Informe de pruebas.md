# Informe de pruebas

Al 19 de noviembre de 2026, GesNoc tiene 620 pruebas automáticas, y todas pasan en la integración
continua.

| Tipo | Cantidad | Qué prueban | Herramienta |
|-|-|-|-|
| Unitarias y de integración | 555, en 55 archivos (31 unitarios y 24 de integración) | La lógica pura (dinero, ruta de cada ítem a su estación, plano de mesas, vigencia de las listas) y los servicios reales contra PostgreSQL 17: reglas del negocio, permisos, transacciones y restricciones de la base | Vitest |
| De extremo a extremo | 65, en 18 archivos | Un navegador automático usa el sistema como el garzón, la barra, la cocina, el guardia y la administración, en una pantalla de teléfono de 360 px | Playwright |

Desde la carpeta `desarrollo`: `npm test` (unitarias e integración), `npm run test:e2e` (extremo a
extremo) y `npm run carga` (prueba de carga).

## Tres noches simuladas

Una prueba de integración simula tres noches completas, de la apertura al cierre:

| Noche | Qué pasa | Pedidos | Ingresos | Cortes de red | Caja | Acciones fuera de turno rechazadas |
|-|-|-|-|-|-|-|
| Jueves | Noche tranquila, solo en el Salón: lista que paga, invitado del DJ, pedido mixto, anulación, llamado, sorteo y cierre que cuadra | 27 | 25 | 1 | Cuadra exacto | 6 de 6 |
| Viernes | Noche llena en dos ambientes, con dos teléfonos en la puerta a la vez: cortes de red, producto agotado, cambio de precio, pelea y expulsión, cobros simultáneos, cliente que se va sin pagar y diferencia de caja con nota | 306 | 402 | 28 | −$2.000 con nota | 34 de 34 |
| Sábado | 12 personas de turno, ambiente nuevo, mesa retirada y renumerada, cuenta desactivada a mitad de noche, sesión vencida, bloqueo por intentos fallidos y anonimización de quien cumplió 12 meses sin venir | 24 | 60 | 1 | +$1.000 con nota | 28 de 28 |

En cada noche se comprueba:

- **OE1:** el 100 % de los ítems llegó a la estación correcta, cada comanda lista avisó solo al
  garzón que tomó el pedido y cada llamado llegó solo a los garzones de su ambiente.
- **OE2:** el esperado de la caja es igual al cálculo de control y la diferencia queda con su nota.
  Ningún pago se registró dos veces ni superó el consumo.
- **OE3:** no hay ingresos duplicados ni tickets repetidos o salteados, y cada sorteo premió un
  ticket de esa noche.
- **OE4:** el 100 % de las acciones fuera del turno o del rol se rechazó.
- **Cierre:** después de cerrar la noche no se registra nada más y el personal pierde su turno.

## Prueba de carga (40 teléfonos)

`npm run carga` corrió el 17 de noviembre contra la compilación de producción y PostgreSQL 17 en
Docker, con 40 dispositivos (16 garzones, 6 tablets de barra, 4 de cocina, 8 teléfonos en la
puerta, 2 de la administración y 4 clientes con la carta) y dos instancias del servidor. Simuló una
noche completa, con 300 pedidos y 400 ingresos, comprimida en 266 segundos: unas cien veces el ritmo
de una noche real.

| Medida | Meta | Mediana | 95 de cada 100 | 99 de cada 100 | Errores |
|-|-|-|-|-|-|
| Enviar un pedido (300) | ≤ 800 ms | 41 ms | **59 ms** | 70 ms | 0 |
| Registrar un pago (141) | ≤ 800 ms | 28 ms | **37 ms** | 42 ms | 0 |
| Registrar un ingreso (400) | ≤ 800 ms | 28 ms | **40 ms** | 47 ms | 0 |
| Pedido nuevo visible en su estación (300) | ≤ 5 s | 0,43 s | **1,23 s** | 1,36 s | — |
| Comanda lista visible para el garzón (393) | ≤ 5 s | 0,24 s | **0,73 s** | 0,86 s | — |

**Integridad al terminar:** los 300 pedidos, 141 pagos y 400 ingresos son exactamente los que los
teléfonos recibieron como hechos, sin duplicados; los tickets son únicos y sin saltos, y ninguna
cuenta cobró más que su consumo. Es el tiempo del servidor en una máquina local: en el sistema
publicado se suma la red entre el teléfono, Railway y Supabase.

## Escenarios de evaluación

| Escenario | Estado | Evidencia |
|-|-|-|
| EV-01 Pedidos | Cumplido | Tres noches (306 pedidos el viernes, en dos ambientes) y carga |
| EV-02 Caja | Cumplido | Tres cierres, uno con diferencia a propósito |
| EV-03 Puerta y sorteo | Cumplido | 402 ingresos con dos teléfonos a la vez; sorteo en los dos ambientes |
| EV-04 Turnos | Cumplido | Sábado con 12 personas de turno |
| EV-05 Reintentos | Cumplido | 30 cortes de red sin duplicados; extremo a extremo |
| EV-06 Permisos | Cumplido | Acciones fuera del turno rechazadas; extremo a extremo |
| EV-07 Carga | Cumplido | Prueba de carga con 40 teléfonos |
| EV-08 Portabilidad | Cumplido | La misma imagen de Docker corre en local y en Railway; desde el 19 de noviembre la integración continua también la construye |
| EV-09 Uso y compatibilidad | Parcial | Probado en Chrome de Android y de escritorio; falta Safari en iPhone y una medición de usabilidad con personas reales |
| EV-10 Carta y llamados | Cumplido | 10 mesas, llamado repetido, intervalo de 60 s y código regenerado; extremo a extremo |
| EV-11 Seguridad en la puerta | Parcial | Invitados, reportes y permisos cumplidos; la lectura de la cédula quedó fuera |

## Accesibilidad y diseño

Un recorrido de 13 pantallas, en teléfono (360 px) y en escritorio, se revisó con axe-core según las
pautas WCAG 2.2 nivel AA: sin fallas ni desborde horizontal. Los botones y campos miden al menos
44 px, para usarlos con el dedo.

## Errores encontrados al final y su prueba nueva

| Error | Causa | Lo que lo detecta ahora |
|-|-|-|
| La publicación en Railway falló durante un día | La imagen de Docker dejaba fuera la carpeta de pruebas, y una de ellas la necesitaba para revisar los tipos. En la integración continua la carpeta estaba, así que pasaba | La integración continua construye la misma imagen de Docker que se publica |
| En el teléfono, arrastrar una mesa con el dedo desplazaba la página | `touch-action` no rige dentro del SVG del plano | Una prueba de extremo a extremo arrastra con eventos táctiles reales de Chrome |
