# ADR-006: Autenticación propia: usuario + sesión

Estado: aceptada (propuesta en septiembre de 2026; vigente al 19 de noviembre de 2026)

## Contexto

Better Auth exige cuatro tablas (usuario, sesión, cuenta y verificación). Cada tabla debe defenderse. No hay inicio con Google ni verificación por correo.

## Opciones consideradas

Better Auth con tablas renombradas; Auth.js (en mantenimiento); sesión propia.

## Decisión

Sesión propia: USUARIO con hash argon2id y SESION con el SHA-256 del token, cookie `httpOnly`. Dos tablas, ambas con requisito.

## Consecuencias

Más código propio de autenticación (≈ 200 líneas y sus pruebas), a cambio de un modelo sin tablas injustificables. Se usan bibliotecas probadas para el hash (`@node-rs/argon2`) y el token (`crypto.randomBytes`).
