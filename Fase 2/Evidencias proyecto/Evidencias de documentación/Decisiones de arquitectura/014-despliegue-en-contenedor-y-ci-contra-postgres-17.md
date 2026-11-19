# ADR-014: Despliegue en contenedor y CI contra postgres:17

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

El despliegue es parte del proyecto y la portabilidad debe demostrarse, no solo afirmarse.

## Opciones consideradas

Plataforma específica (Vercel) sin contenedor; imagen Docker.

## Decisión

Imagen Docker multietapa con Next.js `output: standalone` y usuario sin privilegios. `docker-compose.yml` levanta base, migraciones y aplicación. GitHub Actions corre migraciones y pruebas en un servicio `postgres:17`.

## Consecuencias

La misma imagen corre en Render, Railway, Fly, Cloud Run o un VPS. Cada push prueba que el sistema no depende de Supabase.
