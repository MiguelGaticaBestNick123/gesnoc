# ADR-013: Mapa de mesas en SVG (antes: react-konva)

Estado: reemplazada el 11 de noviembre de 2026. La propuesta original (septiembre) era react-konva;
se construyó con SVG y eventos de puntero.

## Contexto

La administración edita el plano: mover, redimensionar y rotar mesas (HU-05). El garzón lo consulta
en el teléfono (HU-13), donde el plano tiene que caber en 360 px, acercarse y verse a pantalla
completa. La prueba técnica reservada para la semana 8 nunca se hizo.

## Opciones consideradas

- Canvas con react-konva (la propuesta).
- DOM con elementos posicionados y una biblioteca de arrastre.
- SVG dibujado por React, con eventos de puntero.

## Decisión

SVG con eventos de puntero, sin bibliotecas nuevas. Un solo componente, `PlanoMesas`, dibuja el plano
para el garzón y para el editor; la geometría (sillas, ajuste a la pantalla, grilla, límites) es
lógica pura en `modules/local/geometria.ts`, con pruebas unitarias.

## Motivos

- **Escala sin perder nitidez:** el mismo dibujo se ajusta al ancho del teléfono, se acerca o se ve a
  pantalla completa, solo cambiando la escala.
- **Accesible y comprobable:** cada mesa es un elemento con rol de botón y nombre («Mesa 4, libre»),
  así que las pruebas E2E la encuentran por su rol. En un canvas solo se puede probar por
  coordenadas.
- **Sin dependencias:** no agrega una biblioteca, ni un componente que no corra en el servidor.
- **Lo que daba react-konva se resolvió con poco:** arrastrar con eventos de puntero, cambiar el
  tamaño con un tirador en la esquina, y girar con botones de 15 grados.

## Consecuencias

- **Arrastre:** convierte píxeles a unidades del plano dividiendo por la escala. Mientras se
  arrastra, la mesa sigue al dedo o al mouse sin saltos; al soltarla, se ajusta a una grilla de
  10 sin salir del plano.
- **Toque:** el área de toque de cada mesa y del tirador mide al menos 44 px en pantalla (RNF-09),
  aunque la mesa se vea chica.
- **Arrastre con el dedo (19 de noviembre):** en el teléfono, el navegador tomaba el
  deslizamiento como un desplazamiento de la página y cortaba el arrastre, porque `touch-action`
  no rige dentro del SVG. Si el toque empieza sobre una mesa, se cancela el desplazamiento de ese
  toque; sobre el piso vacío, la página se desplaza como siempre. Una prueba de extremo a extremo
  arrastra con eventos táctiles reales de Chrome.
- **Guardado:** el plano se guarda completo en una transacción. Para intercambiar números se
  desactivan, renumeran y reactivan las mesas, porque el índice único parcial no se puede diferir.
- **El garzón también ordena (19 de noviembre):** el mismo editor le sirve al garzón para ordenar
  las mesas de su ambiente al empezar el turno, sin agregar ni retirar mesas.
- **Ajuste declarado** en el informe final: cambio de decisión justificado.
