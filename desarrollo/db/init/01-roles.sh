#!/bin/sh
# Lo ejecuta el contenedor de PostgreSQL solo la primera vez que crea el volumen.
# Pasa las claves como variables de psql para que no queden escritas en roles.sql.
set -eu
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v clave_migrador="$CLAVE_MIGRADOR" -v clave_app="$CLAVE_APP" \
  -f /gesnoc/roles.sql
