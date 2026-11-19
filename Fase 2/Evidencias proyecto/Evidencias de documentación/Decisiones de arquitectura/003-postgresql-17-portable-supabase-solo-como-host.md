# ADR-003: PostgreSQL 17 portable; Supabase solo como host

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

Se prevé cambiar de proveedor de base de datos después del semestre. Usar Auth, políticas por fila con `auth.uid()` o Realtime ataría el sistema a Supabase.

## Opciones consideradas

Usar Supabase completo (supabase-js, Auth, RLS, Realtime); usar solo su PostgreSQL.

## Decisión

La aplicación se conecta solo por `DATABASE_URL` con un driver estándar (postgres.js + Drizzle). No se usan supabase-js, Auth, Storage, Realtime, Edge Functions ni la Data API.

## Consecuencias

Cambiar de host es cambiar una variable de entorno. Se pierden las comodidades de Supabase (autenticación y tiempo real listos), que se resuelven con ADR-006 y ADR-007.
