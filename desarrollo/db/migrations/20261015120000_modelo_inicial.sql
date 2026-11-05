-- migrate:up

-- GesNoc: modelo físico para PostgreSQL 17
-- Todo el modelo vive en el esquema gesnoc. No usa extensiones ni objetos del
-- proveedor (auth, storage, realtime), por lo que corre igual en Supabase, en un
-- contenedor postgres:17 o en cualquier PostgreSQL 17 administrado.
--
-- Convenciones
--   * Dinero en pesos chilenos enteros (integer), nunca decimales.
--   * Estados que se pueden deducir de marcas de tiempo no se guardan como columna.
--   * Entidades débiles: sin identificador propio; PK = clave del dueño + discriminador.
--   * La noche se identifica por su fecha operativa (clave natural) y todo lo que
--     ocurre en ella hereda esa columna.

-- roles.sql crea el esquema a nombre del migrador; este bloque solo lo crea si se
-- ejecuta el DDL sin roles (ej. una base de prueba). "create schema if not exists"
-- no sirve: PostgreSQL exige permiso sobre la base antes de mirar si ya existe.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'gesnoc') then
    create schema gesnoc;
  end if;
end
$$;
set search_path = gesnoc;

-- =============================================================================
-- Acceso
-- =============================================================================

create table usuario (
  id                integer     generated always as identity primary key,
  nombre            text        not null check (length(trim(nombre)) between 2 and 80),
  correo            text        not null check (correo = lower(correo) and correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  clave_hash        text        not null,
  es_administrador  boolean     not null default false,
  activo            boolean     not null default true,
  intentos_fallidos smallint    not null default 0 check (intentos_fallidos between 0 and 100),
  bloqueado_hasta   timestamptz,
  constraint usuario_correo_uq unique (correo)
);

create table sesion (
  token_hash bytea       primary key check (octet_length(token_hash) = 32),
  usuario_id integer     not null references usuario (id) on delete cascade,
  expira_en  timestamptz not null
);
create index sesion_usuario_ix on sesion (usuario_id);

-- =============================================================================
-- Local: ambientes, mesas y estaciones
-- =============================================================================

create table ambiente (
  id          integer generated always as identity primary key,
  nombre      text    not null check (length(trim(nombre)) between 2 and 40),
  plano_ancho integer not null check (plano_ancho between 200 and 5000),
  plano_alto  integer not null check (plano_alto between 200 and 5000),
  activo      boolean not null default true
);
create unique index ambiente_nombre_uq on ambiente (lower(nombre));

create table mesa (
  id          integer  generated always as identity primary key,
  ambiente_id integer  not null references ambiente (id),
  numero      smallint not null check (numero between 1 and 999),
  forma       text     not null check (forma in ('cuadrada', 'redonda', 'rectangular')),
  pos_x       integer  not null check (pos_x >= 0),
  pos_y       integer  not null check (pos_y >= 0),
  ancho       integer  not null check (ancho between 20 and 400),
  alto        integer  not null check (alto between 20 and 400),
  rotacion    smallint not null default 0 check (rotacion between 0 and 359),
  activa      boolean  not null default true,
  -- El servidor genera el código (aleatorio, opaco) y lo reemplaza al regenerarlo.
  token_qr    text     not null check (token_qr ~ '^[A-Za-z0-9_-]{22,64}$'),
  constraint mesa_proporcion_ck check (forma = 'rectangular' or ancho = alto),
  constraint mesa_token_qr_uq unique (token_qr)
);
create unique index mesa_numero_uq on mesa (ambiente_id, numero) where activa;

create table estacion (
  id          integer generated always as identity primary key,
  ambiente_id integer not null references ambiente (id),
  nombre      text    not null check (length(trim(nombre)) between 2 and 40),
  tipo        text    not null check (tipo in ('barra', 'cocina'))
);
create unique index estacion_nombre_uq on estacion (lower(nombre));
create unique index estacion_barra_uq on estacion (ambiente_id) where tipo = 'barra';

-- =============================================================================
-- Catálogo
-- =============================================================================

create table categoria (
  id          integer generated always as identity primary key,
  nombre      text    not null check (length(trim(nombre)) between 2 and 40),
  regla_ruteo text    not null check (regla_ruteo in ('fija', 'barra_ambiente')),
  estacion_id integer references estacion (id),
  constraint categoria_ruteo_ck check ((regla_ruteo = 'fija') = (estacion_id is not null))
);
create unique index categoria_nombre_uq on categoria (lower(nombre));

create table producto (
  id           integer generated always as identity primary key,
  categoria_id integer not null references categoria (id),
  nombre       text    not null check (length(trim(nombre)) between 2 and 80),
  precio       integer not null check (precio > 0),
  estacion_id  integer references estacion (id),
  activo       boolean not null default true
);
create unique index producto_nombre_uq on producto (lower(nombre));
create index producto_categoria_ix on producto (categoria_id);

-- =============================================================================
-- Noche y turnos
-- =============================================================================

create table noche (
  fecha          date        primary key,
  nota           text        check (length(nota) <= 280),
  precio_entrada integer     not null check (precio_entrada >= 0),
  abierta_en     timestamptz,
  cerrada_en     timestamptz,
  constraint noche_ciclo_ck check (cerrada_en is null or (abierta_en is not null and cerrada_en > abierta_en))
);
create unique index noche_una_abierta_uq on noche ((true)) where abierta_en is not null and cerrada_en is null;

create table disponibilidad (
  fecha      date    not null references noche (fecha) on delete cascade,
  usuario_id integer not null references usuario (id),
  primary key (fecha, usuario_id)
);
create index disponibilidad_usuario_ix on disponibilidad (usuario_id);

create table asignacion (
  fecha       date    not null references noche (fecha) on delete cascade,
  usuario_id  integer not null references usuario (id),
  rol         text    not null check (rol in ('garzon', 'barman', 'cocinero', 'guardia')),
  ambiente_id integer references ambiente (id),
  primary key (fecha, usuario_id),
  constraint asignacion_ambiente_ck check ((rol = 'guardia') = (ambiente_id is null))
);
create index asignacion_usuario_ix on asignacion (usuario_id);

create table arqueo (
  fecha            date    primary key references noche (fecha),
  fondo_inicial    integer not null check (fondo_inicial >= 0),
  efectivo_contado integer check (efectivo_contado >= 0),
  nota             text    check (length(nota) <= 500),
  contado_por      integer references usuario (id),
  constraint arqueo_conteo_ck check ((efectivo_contado is null) = (contado_por is null))
);

-- =============================================================================
-- Venta: cuentas, pedidos, comandas y pagos
-- =============================================================================

create table cuenta (
  fecha       date        not null references noche (fecha),
  numero      integer     not null check (numero > 0),
  mesa_id     integer     references mesa (id),
  ambiente_id integer     references ambiente (id),
  referencia  text        check (length(trim(referencia)) between 1 and 60),
  abierta_por integer     not null references usuario (id),
  abierta_en  timestamptz not null default now(),
  cerrada_por integer     references usuario (id),
  cerrada_en  timestamptz,
  primary key (fecha, numero),
  constraint cuenta_ubicacion_ck check (
    (mesa_id is not null and ambiente_id is null and referencia is null) or
    (mesa_id is null and ambiente_id is not null and referencia is not null)),
  constraint cuenta_cierre_ck check ((cerrada_en is null) = (cerrada_por is null)),
  constraint cuenta_cierre_orden_ck check (cerrada_en is null or cerrada_en >= abierta_en)
);
create unique index cuenta_mesa_abierta_uq on cuenta (mesa_id) where cerrada_en is null;

create table pedido (
  fecha         date        not null references noche (fecha),
  numero        integer     not null check (numero > 0),
  cuenta_numero integer     not null,
  tomado_por    integer     not null references usuario (id),
  enviado_en    timestamptz not null default now(),
  personas      smallint    check (personas between 1 and 50),
  clave_envio   uuid        not null,
  primary key (fecha, numero),
  constraint pedido_cuenta_fk foreign key (fecha, cuenta_numero) references cuenta (fecha, numero),
  constraint pedido_clave_envio_uq unique (clave_envio)
);
create index pedido_cuenta_ix on pedido (fecha, cuenta_numero);

create table comanda (
  fecha         date        not null,
  pedido_numero integer     not null,
  estacion_id   integer     not null references estacion (id),
  lista_en      timestamptz,
  entregada_en  timestamptz,
  primary key (fecha, pedido_numero, estacion_id),
  constraint comanda_pedido_fk foreign key (fecha, pedido_numero)
    references pedido (fecha, numero) on delete cascade,
  constraint comanda_ciclo_ck check (entregada_en is null or (lista_en is not null and entregada_en >= lista_en))
);
create index comanda_cola_ix on comanda (estacion_id, fecha) where entregada_en is null;

create table detalle_pedido (
  fecha           date        not null,
  pedido_numero   integer     not null,
  linea           smallint    not null check (linea between 1 and 200),
  producto_id     integer     not null references producto (id),
  estacion_id     integer     not null,
  cantidad        smallint    not null check (cantidad between 1 and 99),
  precio_unitario integer     not null check (precio_unitario > 0),
  nota            text        check (length(nota) <= 140),
  anulado_por     integer     references usuario (id),
  anulado_en      timestamptz,
  primary key (fecha, pedido_numero, linea),
  constraint detalle_pedido_fk foreign key (fecha, pedido_numero)
    references pedido (fecha, numero) on delete cascade,
  constraint detalle_comanda_fk foreign key (fecha, pedido_numero, estacion_id)
    references comanda (fecha, pedido_numero, estacion_id) on delete cascade,
  constraint detalle_anulacion_ck check ((anulado_en is null) = (anulado_por is null))
);
create index detalle_comanda_ix on detalle_pedido (fecha, pedido_numero, estacion_id);

create table pago (
  fecha          date        not null,
  cuenta_numero  integer     not null,
  numero         smallint    not null check (numero between 1 and 50),
  medio          text        not null check (medio in ('efectivo', 'tarjeta', 'transferencia')),
  monto          integer     not null check (monto > 0),
  propina        integer     not null default 0 check (propina >= 0),
  registrado_por integer     not null references usuario (id),
  registrado_en  timestamptz not null default now(),
  confirmado_por integer     references usuario (id),
  confirmado_en  timestamptz,
  clave_envio    uuid        not null,
  primary key (fecha, cuenta_numero, numero),
  constraint pago_cuenta_fk foreign key (fecha, cuenta_numero) references cuenta (fecha, numero),
  constraint pago_clave_envio_uq unique (clave_envio),
  constraint pago_confirmacion_ck check ((confirmado_en is null) = (confirmado_por is null)),
  constraint pago_confirma_efectivo_ck check (medio = 'efectivo' or confirmado_en is null)
);
create index pago_efectivo_pendiente_ix on pago (fecha) where medio = 'efectivo' and confirmado_en is null;

-- =============================================================================
-- Portería y sorteo
-- =============================================================================

create table cliente (
  id        integer generated always as identity primary key,
  documento text    not null check (documento ~ '^[0-9A-Z]{4,15}(-[0-9K])?$'),
  nombre    text    not null check (length(trim(nombre)) between 1 and 60),
  apellido  text    not null check (length(trim(apellido)) between 1 and 60),
  constraint cliente_documento_uq unique (documento)
);

create table invitado (
  id        integer generated always as identity primary key,
  nombre    text    not null check (length(trim(nombre)) between 2 and 80),
  documento text    check (documento ~ '^[0-9A-Z]{4,15}(-[0-9K])?$'),
  nota      text    check (length(nota) <= 280),
  activo    boolean not null default true
);
-- Un documento figura una sola vez entre los invitados activos.
create unique index invitado_documento_uq on invitado (documento) where activo and documento is not null;

create table entrada (
  fecha          date        not null references noche (fecha),
  cliente_id     integer     not null references cliente (id),
  monto          integer     not null check (monto >= 0),
  medio_pago     text        check (medio_pago in ('efectivo', 'tarjeta', 'transferencia')),
  ticket         integer     check (ticket > 0),
  registrada_por integer     not null references usuario (id),
  registrada_en  timestamptz not null default now(),
  invitado_id    integer     references invitado (id),
  primary key (fecha, cliente_id),
  constraint entrada_ticket_uq unique (fecha, ticket),
  constraint entrada_pago_ck check (
    (monto = 0 and medio_pago is null and ticket is null) or
    (monto > 0 and medio_pago is not null and ticket is not null)),
  constraint entrada_invitado_ck check (invitado_id is null or (monto = 0 and medio_pago is null and ticket is null))
);
create index entrada_cliente_ix on entrada (cliente_id);
create index entrada_invitado_ix on entrada (invitado_id) where invitado_id is not null;

create table sorteo (
  fecha          date        not null references noche (fecha),
  ambiente_id    integer     not null references ambiente (id),
  premio         text        not null check (length(trim(premio)) between 2 and 80),
  ticket_ganador integer     not null,
  realizado_por  integer     not null references usuario (id),
  realizado_en   timestamptz not null default now(),
  primary key (fecha, ambiente_id),
  constraint sorteo_ganador_fk foreign key (fecha, ticket_ganador) references entrada (fecha, ticket),
  constraint sorteo_ganador_uq unique (fecha, ticket_ganador)
);

-- =============================================================================
-- Atención al cliente y seguridad: llamados y reportes
-- =============================================================================

create table llamado (
  fecha        date        not null references noche (fecha),
  numero       integer     not null check (numero > 0),
  mesa_id      integer     not null references mesa (id),
  creado_en    timestamptz not null default now(),
  atendido_por integer     references usuario (id),
  atendido_en  timestamptz,
  primary key (fecha, numero),
  constraint llamado_atencion_ck check ((atendido_en is null) = (atendido_por is null)),
  constraint llamado_atencion_orden_ck check (atendido_en is null or atendido_en >= creado_en)
);
-- Un llamado pendiente por mesa. Incluye la fecha para que un llamado que quedó sin
-- atender en una noche cerrada no bloquee la mesa en la noche siguiente.
create unique index llamado_pendiente_uq on llamado (fecha, mesa_id) where atendido_en is null;
-- Último llamado de la mesa, para el intervalo mínimo de 60 segundos (servidor).
create index llamado_mesa_ix on llamado (mesa_id, creado_en);

create table reporte (
  cliente_id     integer     not null references cliente (id),
  numero         smallint    not null check (numero between 1 and 999),
  fecha          date        not null references noche (fecha),
  tipo           text        not null check (tipo in ('advertencia', 'expulsion', 'observacion')),
  descripcion    text        not null check (length(trim(descripcion)) between 2 and 1000),
  registrado_por integer     not null references usuario (id),
  registrado_en  timestamptz not null default now(),
  primary key (cliente_id, numero)
);
create index reporte_fecha_ix on reporte (fecha);

-- =============================================================================
-- Permisos: la historia de dinero y de la puerta no se borra desde la aplicación,
-- y de ella solo se actualizan las columnas que registran un evento posterior
-- (cierre, lista, entrega, anulación, confirmación y conteo).
-- Solo aplica donde existe el rol de la aplicación (ver roles.sql).
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'gesnoc_app') then
    revoke delete, update on cuenta, pedido, detalle_pedido, comanda, pago, arqueo, entrada, sorteo
      from gesnoc_app;
    grant update (cerrada_por, cerrada_en) on cuenta to gesnoc_app;
    grant update (lista_en, entregada_en) on comanda to gesnoc_app;
    grant update (anulado_por, anulado_en) on detalle_pedido to gesnoc_app;
    grant update (confirmado_por, confirmado_en) on pago to gesnoc_app;
    grant update (efectivo_contado, nota, contado_por) on arqueo to gesnoc_app;
    -- Del llamado solo se registra la atención; del reporte, solo la descripción, y
    -- solo para anonimizarla (el servidor no la ofrece como edición).
    revoke delete, update on llamado, reporte from gesnoc_app;
    grant update (atendido_por, atendido_en) on llamado to gesnoc_app;
    grant update (descripcion) on reporte to gesnoc_app;
  end if;
end
$$;

-- =============================================================================
-- Documentación en el catálogo (fuente del diccionario de datos)
-- Formato: descripción [requisitos que la justifican]
-- =============================================================================

comment on schema gesnoc is 'Modelo de datos de GesNoc. Es el único esquema que pertenece al sistema.';

comment on table usuario is 'Persona del equipo que inicia sesión en el sistema: administración o personal. [RF-01, RF-03, RF-04]';
comment on column usuario.id is 'Identificador sustituto; el correo puede cambiar. [RF-03]';
comment on column usuario.nombre is 'Nombre visible en turnos, comandas y pagos. [RF-03, RF-12, RF-21]';
comment on column usuario.correo is 'Correo de inicio de sesión, único y en minúsculas. [RF-01, RF-03]';
comment on column usuario.clave_hash is 'Hash argon2id de la contraseña; la contraseña nunca se guarda. [RF-01, RF-03]';
comment on column usuario.es_administrador is 'Verdadero para administración: accede a todo sin asignación nocturna. [RF-04]';
comment on column usuario.activo is 'Falso desactiva la cuenta sin borrar su historial. [RF-03]';
comment on column usuario.intentos_fallidos is 'Intentos fallidos seguidos de inicio de sesión; vuelve a 0 al entrar. [RF-01]';
comment on column usuario.bloqueado_hasta is 'Hasta cuándo se rechaza el inicio de sesión tras cinco intentos fallidos. [RF-01]';

comment on table sesion is 'Sesión abierta en un dispositivo. Permite cerrar sesión y cortar el acceso de inmediato al desactivar una cuenta. [RF-01, RF-02, RF-03]';
comment on column sesion.token_hash is 'SHA-256 del token de la cookie; si la base se filtra, el token no sirve. [RF-01]';
comment on column sesion.usuario_id is 'Dueño de la sesión. [RF-01, RF-03]';
comment on column sesion.expira_en is 'Vencimiento absoluto de la sesión. [RF-02]';

comment on table ambiente is 'Sector físico del local con mesas y barra propias (ej. Salón, Terraza). [RF-05, RF-06, RF-12]';
comment on column ambiente.id is 'Identificador sustituto; el nombre es editable. [RF-05]';
comment on column ambiente.nombre is 'Nombre único del ambiente. [RF-05]';
comment on column ambiente.plano_ancho is 'Ancho del lienzo del mapa de mesas, en unidades del plano. [RF-06, RF-15]';
comment on column ambiente.plano_alto is 'Alto del lienzo del mapa de mesas, en unidades del plano. [RF-06, RF-15]';
comment on column ambiente.activo is 'Falso retira el ambiente sin perder su historial. [RF-05]';

comment on table mesa is 'Mesa dibujada en el plano de un ambiente. [RF-06, RF-15, RF-16]';
comment on column mesa.id is 'Identificador sustituto estable; el número se puede cambiar. [RF-06]';
comment on column mesa.ambiente_id is 'Ambiente al que pertenece la mesa. [RF-06]';
comment on column mesa.numero is 'Número visible; único entre las mesas activas del ambiente. [RF-06, RF-15]';
comment on column mesa.forma is 'Forma dibujada en el plano. [RF-06]';
comment on column mesa.pos_x is 'Posición horizontal en el plano. [RF-06, RF-15]';
comment on column mesa.pos_y is 'Posición vertical en el plano. [RF-06, RF-15]';
comment on column mesa.ancho is 'Ancho en el plano. [RF-06]';
comment on column mesa.alto is 'Alto en el plano. [RF-06]';
comment on column mesa.rotacion is 'Rotación en grados. [RF-06]';
comment on column mesa.activa is 'Falso retira la mesa del plano y libera su número. [RF-06]';
comment on column mesa.token_qr is 'Código opaco del QR que abre la carta de la mesa; único y se reemplaza al regenerarlo. [RF-33, RF-34]';

comment on table estacion is 'Punto de preparación que recibe comandas: barra o cocina. [RF-07, RF-18, RF-21]';
comment on column estacion.id is 'Identificador sustituto. [RF-07]';
comment on column estacion.ambiente_id is 'Ambiente donde está la estación; define la barra del ambiente. [RF-07, RF-18]';
comment on column estacion.nombre is 'Nombre único (ej. Barra Terraza). [RF-07, RF-21]';
comment on column estacion.tipo is 'barra o cocina; decide qué rol la atiende y si exige número de personas. [RF-04, RF-07, RF-17]';

comment on table categoria is 'Agrupación del catálogo que define el ruteo por defecto de sus productos. [RF-08, RF-17, RF-18]';
comment on column categoria.id is 'Identificador sustituto. [RF-08]';
comment on column categoria.nombre is 'Nombre único de la categoría. [RF-08, RF-17]';
comment on column categoria.regla_ruteo is 'fija (va a una estación) o barra_ambiente (va a la barra del ambiente de la cuenta). [RF-08, RF-18]';
comment on column categoria.estacion_id is 'Estación destino; solo para la regla fija. [RF-08, RF-18]';

comment on table producto is 'Ítem vendible del catálogo. [RF-09, RF-17]';
comment on column producto.id is 'Identificador sustituto. [RF-09]';
comment on column producto.categoria_id is 'Categoría del producto. [RF-09, RF-18]';
comment on column producto.nombre is 'Nombre único que ven garzón y estación. [RF-09, RF-17, RF-21]';
comment on column producto.precio is 'Precio vigente en CLP; se copia al detalle al pedir. [RF-09, RF-17]';
comment on column producto.estacion_id is 'Estación forzada; si existe, manda sobre la regla de la categoría. [RF-09, RF-18]';
comment on column producto.activo is 'Falso impide pedirlo (agotado o retirado) sin afectar ventas pasadas. [RF-09, RF-17]';

comment on table noche is 'Jornada de apertura del local, identificada por su fecha operativa. Todo lo que ocurre en la jornada cuelga de ella. [RF-10, RF-13, RF-14]';
comment on column noche.fecha is 'Fecha operativa: la noche del viernes 16 que termina el sábado 17 a las 5:00 es la noche 16. [RF-10]';
comment on column noche.nota is 'Aviso al equipo para esa noche (ej. entrada gratis hasta las 00:00). [RF-10, RF-11]';
comment on column noche.precio_entrada is 'Precio vigente de la entrada; administración lo ajusta durante la noche. [RF-10, RF-30]';
comment on column noche.abierta_en is 'Momento de apertura; nulo mientras la noche está solo programada. [RF-13]';
comment on column noche.cerrada_en is 'Momento de cierre; desde ahí la noche no admite cambios. [RF-14]';

comment on table disponibilidad is 'Declaración de una persona de que puede trabajar una noche programada. [RF-11, RF-12]';
comment on column disponibilidad.fecha is 'Noche programada declarada. [RF-11]';
comment on column disponibilidad.usuario_id is 'Persona que se declara disponible. [RF-11]';

comment on table asignacion is 'Turno de una persona en una noche: rol y ambiente de esa noche. [RF-04, RF-12]';
comment on column asignacion.fecha is 'Noche del turno. [RF-12]';
comment on column asignacion.usuario_id is 'Persona asignada. [RF-12]';
comment on column asignacion.rol is 'Rol de esa noche; prevalece sobre cualquier otro para decidir qué puede hacer. [RF-04, RF-12]';
comment on column asignacion.ambiente_id is 'Ambiente del turno; nulo solo para guardia (trabaja en la puerta). [RF-04, RF-12]';

comment on table arqueo is 'Cuadratura de la caja de una noche. [RF-13, RF-27]';
comment on column arqueo.fecha is 'Noche a la que corresponde; a lo más un arqueo por noche. [RF-13]';
comment on column arqueo.fondo_inicial is 'Efectivo con que abre la caja. [RF-13, RF-27]';
comment on column arqueo.efectivo_contado is 'Efectivo contado al cierre; nulo hasta contar. [RF-27]';
comment on column arqueo.nota is 'Explicación obligatoria si el contado difiere del esperado. [RF-27]';
comment on column arqueo.contado_por is 'Quién hizo el conteo. [RF-27]';

comment on table cuenta is 'Consumo que se paga en conjunto: el de una mesa o el de un cliente de pie. [RF-16, RF-20, RF-24]';
comment on column cuenta.fecha is 'Noche de la cuenta (parte de la clave). [RF-16]';
comment on column cuenta.numero is 'Correlativo de la cuenta dentro de la noche. [RF-16, RF-20]';
comment on column cuenta.mesa_id is 'Mesa de la cuenta; nula si el cliente está de pie. [RF-15, RF-16]';
comment on column cuenta.ambiente_id is 'Ambiente de una cuenta sin mesa; define barra y garzones que la atienden. [RF-16, RF-18]';
comment on column cuenta.referencia is 'Seña libre para ubicar al cliente sin mesa (ej. polera roja, barra). [RF-16, RF-21]';
comment on column cuenta.abierta_por is 'Garzón que abrió la cuenta. [RF-16, RF-28]';
comment on column cuenta.abierta_en is 'Momento de apertura. [RF-16, RF-20]';
comment on column cuenta.cerrada_por is 'Quién la cerró (al cubrirse el saldo o por decisión de administración). [RF-24, RF-26]';
comment on column cuenta.cerrada_en is 'Momento de cierre; nulo mientras está abierta. [RF-15, RF-24, RF-26]';

comment on table pedido is 'Cada envío que hace un garzón a una cuenta. [RF-17, RF-21, RF-22]';
comment on column pedido.fecha is 'Noche del pedido (parte de la clave). [RF-17]';
comment on column pedido.numero is 'Correlativo de la noche que se ve en las comandas. [RF-17, RF-21]';
comment on column pedido.cuenta_numero is 'Cuenta a la que se carga; comparte la fecha, así no puede ser de otra noche. [RF-17, RF-20]';
comment on column pedido.tomado_por is 'Garzón que lo envió; a él le llega el aviso de listo. [RF-17, RF-22]';
comment on column pedido.enviado_en is 'Momento del envío; ordena la cola y mide la espera. [RF-17, RF-21]';
comment on column pedido.personas is 'Número de personas; obligatorio si el pedido va a cocina. [RF-17, RF-21]';
comment on column pedido.clave_envio is 'Clave que genera el teléfono por envío; un reintento no duplica el pedido. [RF-17]';

comment on table comanda is 'Parte de un pedido que prepara una estación. [RF-18, RF-21, RF-22, RF-23]';
comment on column comanda.fecha is 'Noche (parte de la clave heredada del pedido). [RF-18]';
comment on column comanda.pedido_numero is 'Pedido al que pertenece. [RF-18]';
comment on column comanda.estacion_id is 'Estación que la prepara; discriminador dentro del pedido. [RF-18, RF-21]';
comment on column comanda.lista_en is 'Momento en que la estación la marcó lista. [RF-22]';
comment on column comanda.entregada_en is 'Momento en que se entregó en la mesa. [RF-23]';

comment on table detalle_pedido is 'Línea de un pedido: un producto con su cantidad y precio congelado. [RF-17, RF-19, RF-20]';
comment on column detalle_pedido.fecha is 'Noche (parte de la clave heredada del pedido). [RF-17]';
comment on column detalle_pedido.pedido_numero is 'Pedido al que pertenece la línea. [RF-17]';
comment on column detalle_pedido.linea is 'Número de línea dentro del pedido; discriminador. [RF-17]';
comment on column detalle_pedido.producto_id is 'Producto pedido. [RF-17, RF-21]';
comment on column detalle_pedido.estacion_id is 'Estación a la que se ruteó al pedir; la liga con su comanda. [RF-18]';
comment on column detalle_pedido.cantidad is 'Unidades pedidas. [RF-17, RF-20]';
comment on column detalle_pedido.precio_unitario is 'Precio del producto al momento de pedir; cambios de catálogo no alteran ventas. [RF-17, RF-20]';
comment on column detalle_pedido.nota is 'Indicación libre para la estación (sin hielo, alergia). [RF-17, RF-21]';
comment on column detalle_pedido.anulado_por is 'Quién anuló la línea. [RF-19]';
comment on column detalle_pedido.anulado_en is 'Momento de la anulación; la línea deja de sumar. [RF-19, RF-20]';

comment on table pago is 'Abono a una cuenta; varios abonos dividen la cuenta. [RF-24, RF-25, RF-27]';
comment on column pago.fecha is 'Noche (parte de la clave heredada de la cuenta). [RF-24]';
comment on column pago.cuenta_numero is 'Cuenta que se abona. [RF-24]';
comment on column pago.numero is 'Número del abono dentro de la cuenta; discriminador. [RF-24]';
comment on column pago.medio is 'efectivo, tarjeta o transferencia. [RF-24, RF-28]';
comment on column pago.monto is 'Monto que descuenta del saldo, sin propina. [RF-24, RF-20]';
comment on column pago.propina is 'Propina agregada en este abono. [RF-24, RF-28]';
comment on column pago.registrado_por is 'Quién cobró. [RF-24, RF-28]';
comment on column pago.registrado_en is 'Momento del cobro. [RF-24, RF-25]';
comment on column pago.confirmado_por is 'Administración que recibió el efectivo; solo aplica a efectivo. [RF-25]';
comment on column pago.confirmado_en is 'Momento de la confirmación del efectivo. [RF-25, RF-27]';
comment on column pago.clave_envio is 'Clave que genera el teléfono por cobro; un reintento no registra dos veces el mismo pago. [RF-24]';

comment on table cliente is 'Persona que entra al local, identificada por su documento. Dato personal. [RF-29, RF-30, RF-32]';
comment on column cliente.id is 'Identificador sustituto; permite corregir un documento mal digitado. [RF-29]';
comment on column cliente.documento is 'RUT normalizado (12345678-K) o documento extranjero en mayúsculas; todo RUT válido se normaliza antes de buscar o guardar. [RF-29]';
comment on column cliente.nombre is 'Nombre de pila. [RF-29, RF-32]';
comment on column cliente.apellido is 'Apellido. [RF-29, RF-32]';

comment on table entrada is 'Ingreso de un cliente al local en una noche. [RF-30, RF-31, RF-32]';
comment on column entrada.fecha is 'Noche del ingreso. [RF-30]';
comment on column entrada.cliente_id is 'Persona que ingresa; una vez por noche. [RF-30]';
comment on column entrada.monto is 'Monto cobrado; 0 si entró gratis. [RF-30, RF-31, RF-27]';
comment on column entrada.medio_pago is 'Medio con que pagó; nulo si entró gratis. [RF-30, RF-31, RF-27]';
comment on column entrada.ticket is 'Número para el sorteo, correlativo de la noche; solo entradas pagadas. [RF-30, RF-32]';
comment on column entrada.registrada_por is 'Guardia que registró el ingreso. [RF-30]';
comment on column entrada.registrada_en is 'Hora de ingreso. [RF-30, RF-31]';
comment on column entrada.invitado_id is 'Invitado de la lista con que ingresó; la entrada es gratis y sin ticket. [RF-39, RF-30]';

comment on table invitado is 'Persona de la lista de invitados del local; entra gratis mientras esté activa. [RF-39]';
comment on column invitado.id is 'Identificador sustituto. [RF-39]';
comment on column invitado.nombre is 'Nombre con que figura en la lista. [RF-39]';
comment on column invitado.documento is 'Documento normalizado como el de cliente, si se conoce. [RF-39]';
comment on column invitado.nota is 'Nota de la administración (ej. quién lo invitó). [RF-39]';
comment on column invitado.activo is 'Solo los invitados activos entran gratis. [RF-39]';

comment on table sorteo is 'Sorteo del premio de un ambiente en una noche. [RF-32]';
comment on column sorteo.fecha is 'Noche del sorteo. [RF-32]';
comment on column sorteo.ambiente_id is 'Ambiente donde se sortea; uno por noche y ambiente. [RF-32]';
comment on column sorteo.premio is 'Premio de esa noche (varía, normalmente una botella). [RF-32]';
comment on column sorteo.ticket_ganador is 'Ticket ganador; debe existir en las entradas de la misma noche. [RF-32]';
comment on column sorteo.realizado_por is 'Quién ejecutó el sorteo. [RF-32]';
comment on column sorteo.realizado_en is 'Momento del sorteo. [RF-32]';

comment on table llamado is 'Llamado de una mesa al garzón desde la carta digital. [RF-35, RF-36]';
comment on column llamado.fecha is 'Noche del llamado (parte de la clave). [RF-35]';
comment on column llamado.numero is 'Correlativo del llamado en la noche. [RF-35]';
comment on column llamado.mesa_id is 'Mesa que llama; define el ambiente cuyos garzones reciben el aviso. [RF-35, RF-36]';
comment on column llamado.creado_en is 'Hora del llamado; ordena los avisos y controla el intervalo mínimo. [RF-35, RF-36]';
comment on column llamado.atendido_por is 'Garzón que lo atendió. [RF-36]';
comment on column llamado.atendido_en is 'Hora de atención; nula mientras está pendiente. [RF-35, RF-36]';

comment on table reporte is 'Reporte de seguridad sobre un cliente; forma parte de su historial. Dato personal. [RF-37, RF-38]';
comment on column reporte.cliente_id is 'Cliente reportado (parte de la clave). [RF-37, RF-38]';
comment on column reporte.numero is 'Número del reporte dentro del historial del cliente; discriminador. [RF-37]';
comment on column reporte.fecha is 'Noche en que ocurrió el hecho. [RF-37]';
comment on column reporte.tipo is 'advertencia, expulsion u observacion. [RF-37]';
comment on column reporte.descripcion is 'Descripción del hecho; se anonimiza junto con el cliente. [RF-37, RF-38]';
comment on column reporte.registrado_por is 'Guardia que redactó el reporte. [RF-37]';
comment on column reporte.registrado_en is 'Hora del registro. [RF-37]';

-- migrate:down

drop table if exists
  gesnoc.reporte, gesnoc.llamado, gesnoc.sorteo, gesnoc.entrada, gesnoc.invitado, gesnoc.cliente,
  gesnoc.pago, gesnoc.detalle_pedido, gesnoc.comanda, gesnoc.pedido, gesnoc.cuenta, gesnoc.arqueo,
  gesnoc.asignacion, gesnoc.disponibilidad, gesnoc.noche, gesnoc.producto, gesnoc.categoria,
  gesnoc.estacion, gesnoc.mesa, gesnoc.ambiente, gesnoc.sesion, gesnoc.usuario;
