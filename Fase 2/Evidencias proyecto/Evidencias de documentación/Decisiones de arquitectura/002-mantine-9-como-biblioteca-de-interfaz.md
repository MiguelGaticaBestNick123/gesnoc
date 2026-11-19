# ADR-002: Mantine 9 como biblioteca de interfaz

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

El sistema necesita mapa de mesas, calendario interactivo de turnos, avisos y modo oscuro. El equipo no quiere Tailwind.

## Opciones consideradas

shadcn/ui (construido sobre Tailwind); Mantine 9.

## Decisión

Mantine 9: `@mantine/schedule` (vistas por día, semana, mes y por recurso, arrastrar y soltar), `@mantine/dates`, `@mantine/form`, `@mantine/notifications` y modo oscuro nativo. El mapa de mesas se dibuja en SVG (ADR-013, reemplazada el 11 de noviembre).

## Consecuencias

Sus componentes son de cliente: la página del servidor obtiene los datos y los pasa a un componente cliente. Exige React ≥ 19.2 (Next.js 16 lo cumple). Más JavaScript que componentes copiados, aceptable para una PWA interna.
