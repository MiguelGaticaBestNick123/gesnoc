-- Roles de base de datos de GesNoc
-- Se ejecuta una vez por ambiente (local, CI, Supabase u otro host) con un usuario
-- administrador del servidor, ANTES de las migraciones. Las claves se pasan como
-- variables de psql y nunca quedan en el repositorio:
--   psql "$URL_ADMIN" -v clave_migrador=... -v clave_app=... -f roles.sql

create role gesnoc_migrador login password :'clave_migrador';
create role gesnoc_app      login password :'clave_app';

-- En un host administrado el administrador no es superusuario: necesita poder actuar como
-- el migrador para dejarle el esquema y definir sus permisos por omisión.
grant gesnoc_migrador to current_user;

-- El migrador es dueño del esquema: solo él ejecuta DDL.
create schema if not exists gesnoc authorization gesnoc_migrador;

-- Control de versiones de la herramienta de migraciones (dbmate), fuera del modelo.
create schema if not exists migraciones authorization gesnoc_migrador;

-- La aplicación solo manipula datos, nunca estructura. Las tablas que cree el
-- migrador nacen con estos permisos; el DDL quita el DELETE sobre la historia.
grant usage on schema gesnoc to gesnoc_app;
alter default privileges for role gesnoc_migrador in schema gesnoc
  grant select, insert, update, delete on tables to gesnoc_app;
