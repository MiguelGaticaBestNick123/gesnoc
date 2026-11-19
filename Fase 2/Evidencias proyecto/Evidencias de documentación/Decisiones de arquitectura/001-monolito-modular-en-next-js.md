# ADR-001: Monolito modular en Next.js

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

Dos personas, un semestre. Se necesita frontend móvil y backend con transacciones.

## Opciones consideradas

API separada (NestJS o Express) + SPA; Next.js con App Router como único proyecto.

## Decisión

Next.js 16 (App Router) con TypeScript estricto: páginas del servidor, acciones de servidor y route handlers, y la lógica en módulos por dominio (`src/modules/<módulo>/servicios` y `repositorios`).

## Consecuencias

Un solo despliegue y un solo lenguaje. El límite entre interfaz y negocio se mantiene por convención de carpetas, no por red. Si mañana se necesita una API pública, los servicios ya están aislados.
