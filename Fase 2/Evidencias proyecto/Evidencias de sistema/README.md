# Evidencias de sistema

GesNoc es una aplicación web para operar la noche de un local con varios ambientes: turnos, pedidos
que llegan solos a la barra o a la cocina, cobro, caja, puerta, sorteo y carta por código QR. Se usa
desde el teléfono de cada persona.

## El sistema publicado

- **Dirección:** https://gesnoc-production.up.railway.app
- **Dónde corre:** el servidor, en Railway, dentro de un contenedor Docker; la base de datos
  PostgreSQL 17, en Supabase. Los dos están en la costa este de Estados Unidos.
- **Acceso:** las cuentas de prueba se entregan a los docentes por separado; no se publican en el
  repositorio.

## El código

- **Dónde está:** la aplicación completa está en [desarrollo](<../../../desarrollo/>). Usa Next.js
  16, React 19, Mantine 9, TypeScript, Drizzle y PostgreSQL 17.
- **Cómo está organizado:** seis módulos (acceso, local, noche, venta, caja y portería), cada uno con
  las mismas capas: pantallas, entrada validada, permisos, reglas del negocio, acceso a datos y base
  de datos. El detalle está en [desarrollo/README.md](<../../../desarrollo/README.md>) y en las
  [decisiones de arquitectura](<../Evidencias de documentación/Decisiones de arquitectura/>).

## Cómo correrlo en un computador

Requiere Docker y Node 24. Desde la carpeta `desarrollo`:

```bash
cp .env.example .env              # y completar las claves locales
docker compose up -d db migrar    # PostgreSQL 17, sus roles y las migraciones
npm install
npm run db:semilla                # local de demostración, con datos inventados
npm run dev                       # http://localhost:3000
```

## La base de datos

- **Tablas:** 27, en el esquema `gesnoc`, creadas por las migraciones de
  [desarrollo/db/migrations](<../../../desarrollo/db/migrations/>).
- **Roles:** uno es dueño del esquema y aplica las migraciones; el otro lo usa la aplicación y no
  puede borrar la historia del dinero ni de la puerta.
- **Respaldo:** `npm run host:respaldo` respalda la base publicada, y `npm run respaldo:probar`
  comprueba que el respaldo se puede restaurar.
- **Modelo:** ver [Modelo de datos](<../Evidencias de documentación/Modelo de datos/>).

## Pruebas e integración continua

- **Pruebas:** 620 automáticas, más una prueba de carga con 40 teléfonos. El detalle está en el
  [Informe de pruebas](<Informe de pruebas.md>).
- **Integración continua:** GitHub Actions ([ci.yml](<../../../.github/workflows/ci.yml>)) corre con
  cada cambio: roles y migraciones, formato, revisión del código, tipos, pruebas unitarias y de
  integración, construcción, pruebas de extremo a extremo y la imagen de Docker. Railway publica una
  versión nueva solo si todo pasa.

## Capturas

Pantallas del local de demostración, con datos inventados, en teléfono (360 px) y en escritorio.

| N.° | Pantalla | Rol |
|-|-|-|
| [01](<Capturas/01_carta_del_cliente.png>) | Carta por código QR | Cliente |
| [02](<Capturas/02_llamado_desde_la_carta.png>) | Llamar al garzón desde la carta | Cliente |
| [03](<Capturas/03_garzon_mapa_de_mesas.png>) | Mapa de mesas con su estado | Garzón |
| [04](<Capturas/04_garzon_tomar_pedido.png>) | Tomar un pedido | Garzón |
| [05](<Capturas/05_cocina_recibe_el_pedido.png>) | El pedido llega solo a la cocina, con su hora y su garzón | Cocina |
| [06](<Capturas/06_barra_pedido_con_nota.png>) | Cola de la barra, con la nota de alergia destacada | Barra |
| [07](<Capturas/07_garzon_aviso_del_llamado.png>) | Aviso de una mesa que llama | Garzón |
| [08](<Capturas/08_cobro_por_items.png>) | Cobro en partes, por ítems | Garzón |
| [09](<Capturas/09_garzon_historial_de_comandas.png>) | Historial de comandas | Garzón |
| [10](<Capturas/10_chat_del_personal.png>) | Chat del personal | Garzón |
| [11](<Capturas/11_ordenar_mesas.png>) | Ordenar las mesas del ambiente | Garzón |
| [12](<Capturas/12_puerta_reportes.png>) | Ingreso con aviso de reportes anteriores | Guardia |
| [13](<Capturas/13_puerta_historial.png>) | Historial de un cliente | Guardia |
| [14](<Capturas/14_puerta_cliente_frecuente.png>) | Cliente reconocido por la lista «Clientes frecuentes» | Guardia |
| [15](<Capturas/15_sorteo.png>) | Sorteo entre quienes pagaron | Guardia y administración |
| [16](<Capturas/16_confirmar_efectivo.png>) | Confirmar el efectivo de cada garzón | Administración |
| [17](<Capturas/17_arqueo.png>) | Cuadre de la caja | Administración |
| [18](<Capturas/18_indicadores.png>) | Panel de indicadores | Administración |
| [19](<Capturas/19_bitacora.png>) | Bitácora de la noche | Administración |
| [20](<Capturas/20_asignacion_de_turnos.png>) | Asignación de turnos con el rol habitual | Administración |
| [21](<Capturas/21_personal_y_roles.png>) | Personal con su rol habitual | Administración |
| [22](<Capturas/22_nota_de_la_noche.png>) | Nota de la noche con promociones | Administración |
| [23](<Capturas/23_listas_con_vigencia.png>) | Listas de invitados con vigencia | Administración |
| [24](<Capturas/24_historial_de_comandas.png>) | Historial de comandas en escritorio | Administración |
| [25](<Capturas/25_codigos_qr.png>) | Códigos QR de las mesas | Administración |
