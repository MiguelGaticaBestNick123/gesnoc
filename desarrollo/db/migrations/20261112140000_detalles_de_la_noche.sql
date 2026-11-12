-- migrate:up

-- Detalles de cada noche (pedido del Product Owner, 12 de noviembre de 2026). La administración
-- elige del catálogo el premio del sorteo de cada ambiente, anota los eventos de la noche (show de
-- baile, banda, robot de shots) y carga las listas y los invitados que la puerta debe reconocer.
-- Las listas y los invitados son de una noche: reemplazan la lista de invitados del local, que no
-- dependía de la noche y que la aplicación nunca llegó a usar (HU-33 y HU-34 no se construyeron).

-- Premio del sorteo de un ambiente: una o más botellas del catálogo (RN-23: un sorteo por ambiente y
-- noche). Al sortear, su descripción se copia en sorteo.premio, que queda como registro.
create table gesnoc.premio (
  fecha       date     not null references gesnoc.noche (fecha) on delete cascade,
  ambiente_id integer  not null references gesnoc.ambiente (id),
  producto_id integer  not null references gesnoc.producto (id),
  cantidad    smallint not null default 1 check (cantidad between 1 and 10),
  primary key (fecha, ambiente_id, producto_id)
);
create index premio_producto_ix on gesnoc.premio (producto_id);
create index premio_ambiente_ix on gesnoc.premio (ambiente_id);

-- Evento de la noche, para que el equipo y la puerta sepan qué viene y a qué hora.
create table gesnoc.evento (
  fecha  date     not null references gesnoc.noche (fecha) on delete cascade,
  numero smallint not null check (numero between 1 and 50),
  nombre text     not null check (length(trim(nombre)) between 2 and 80),
  hora   time,
  primary key (fecha, numero)
);

-- Lista de una noche: un cumpleaños, un grupo de bailarines. Quien la organiza envía antes los
-- datos de cada persona, para no registrarlos en la puerta. La lista dice si entran gratis (los
-- bailarines) o pagan su entrada (un cumpleaños).
create table gesnoc.lista (
  fecha       date     not null references gesnoc.noche (fecha) on delete cascade,
  numero      smallint not null check (numero between 1 and 99),
  nombre      text     not null check (length(trim(nombre)) between 2 and 60),
  responsable text     not null check (length(trim(responsable)) between 2 and 80),
  gratis      boolean  not null,
  primary key (fecha, numero)
);
create unique index lista_nombre_uq on gesnoc.lista (fecha, lower(nombre));

-- Persona esperada en la puerta una noche: parte de una lista, o invitada por alguien (un cliente
-- habitual, un amigo del DJ). La puerta la reconoce por su documento, normalizado como el del
-- cliente (RN-21). Si es de una lista, la lista dice si entra gratis; si no, lo dice la invitación.
create table gesnoc.invitacion (
  fecha        date     not null references gesnoc.noche (fecha) on delete cascade,
  documento    text     not null check (documento ~ '^[0-9A-Z]{4,15}(-[0-9K])?$'),
  nombre       text     not null check (length(trim(nombre)) between 1 and 60),
  apellido     text     not null check (length(trim(apellido)) between 1 and 60),
  lista_numero smallint,
  invitado_por text     check (length(trim(invitado_por)) between 2 and 80),
  gratis       boolean,
  primary key (fecha, documento),
  constraint invitacion_lista_fk foreign key (fecha, lista_numero)
    references gesnoc.lista (fecha, numero) on delete cascade,
  constraint invitacion_origen_ck check (
    (lista_numero is null) = (invitado_por is not null)
    and (lista_numero is null) = (gratis is not null))
);
create index invitacion_lista_ix on gesnoc.invitacion (fecha, lista_numero)
  where lista_numero is not null;

-- La entrada se paga como en el local: efectivo (EF), tarjeta (RC) o pendiente (PN), que la persona
-- paga después a la administración. Gratis no lleva medio ni ticket (RN-22). Si la persona venía en
-- una lista o invitada, se deduce de la invitación de esa noche con su documento.
alter table gesnoc.entrada drop constraint entrada_medio_pago_check;
alter table gesnoc.entrada
  add constraint entrada_medio_pago_check check (medio_pago in ('efectivo', 'tarjeta', 'pendiente'));
alter table gesnoc.entrada drop column invitado_id;
drop table gesnoc.invitado;

comment on table gesnoc.premio is
  'Botella o botellas del catálogo que se sortean en un ambiente una noche. [RF-10, RF-32]';
comment on column gesnoc.premio.fecha is 'Noche del sorteo (noche.fecha). [RF-10, RF-32]';
comment on column gesnoc.premio.ambiente_id is 'Ambiente cuyo sorteo entrega el premio. [RF-32]';
comment on column gesnoc.premio.producto_id is 'Producto del catálogo que se entrega. [RF-09, RF-32]';
comment on column gesnoc.premio.cantidad is 'Unidades de ese producto, de 1 a 10. [RF-32]';

comment on table gesnoc.evento is
  'Evento anunciado para una noche (show de baile, banda, robot de shots). [RF-10, RF-11]';
comment on column gesnoc.evento.fecha is 'Noche del evento (noche.fecha). [RF-10]';
comment on column gesnoc.evento.numero is 'Discriminador del evento dentro de la noche. [RF-10]';
comment on column gesnoc.evento.nombre is 'Qué ocurre (ej. Show de baile). [RF-10, RF-11]';
comment on column gesnoc.evento.hora is 'Hora anunciada, si se conoce. [RF-10, RF-11]';

comment on table gesnoc.lista is
  'Grupo que una persona organiza para una noche (cumpleaños, bailarines). [RF-39]';
comment on column gesnoc.lista.fecha is 'Noche de la lista (noche.fecha). [RF-39]';
comment on column gesnoc.lista.numero is 'Discriminador de la lista dentro de la noche. [RF-39]';
comment on column gesnoc.lista.nombre is 'Nombre único en la noche (ej. Cumpleaños de Camila). [RF-39]';
comment on column gesnoc.lista.responsable is 'Quién organiza la lista y envió los datos. [RF-39]';
comment on column gesnoc.lista.gratis is 'Verdadero si quienes vienen en ella entran gratis (ej. bailarines). [RF-39, RF-30]';

comment on table gesnoc.invitacion is
  'Persona esperada en la puerta una noche, de una lista o invitada por alguien. Dato personal. [RF-39, RF-29]';
comment on column gesnoc.invitacion.fecha is 'Noche de la invitación (noche.fecha). [RF-39]';
comment on column gesnoc.invitacion.documento is 'Documento normalizado como el de cliente (RN-21). [RF-29, RF-39]';
comment on column gesnoc.invitacion.nombre is 'Nombre, para registrarla sin escribirlo en la puerta. [RF-29, RF-39]';
comment on column gesnoc.invitacion.apellido is 'Apellido, para registrarla sin escribirlo en la puerta. [RF-29, RF-39]';
comment on column gesnoc.invitacion.lista_numero is 'Lista de la que forma parte; nulo si es una invitación individual. [RF-39]';
comment on column gesnoc.invitacion.invitado_por is 'Quién la invitó (ej. DJ, administración); solo en invitaciones individuales. [RF-39]';
comment on column gesnoc.invitacion.gratis is 'Si entra gratis; solo en invitaciones individuales (en una lista, lo dice la lista). [RF-39, RF-30]';

comment on column gesnoc.entrada.medio_pago is
  'efectivo (EF), tarjeta (RC) o pendiente (PN, se paga después a la administración); nulo si entró gratis. [RF-30, RF-31, RF-27]';

-- migrate:down

create table gesnoc.invitado (
  id        integer generated always as identity primary key,
  nombre    text    not null check (length(trim(nombre)) between 2 and 80),
  documento text    check (documento ~ '^[0-9A-Z]{4,15}(-[0-9K])?$'),
  nota      text    check (length(nota) <= 280),
  activo    boolean not null default true
);
create unique index invitado_documento_uq on gesnoc.invitado (documento)
  where activo and documento is not null;

alter table gesnoc.entrada add column invitado_id integer references gesnoc.invitado (id);
alter table gesnoc.entrada add constraint entrada_invitado_ck
  check (invitado_id is null or (monto = 0 and medio_pago is null and ticket is null));
create index entrada_invitado_ix on gesnoc.entrada (invitado_id) where invitado_id is not null;
alter table gesnoc.entrada drop constraint entrada_medio_pago_check;
alter table gesnoc.entrada add constraint entrada_medio_pago_check
  check (medio_pago in ('efectivo', 'tarjeta', 'transferencia'));

drop table gesnoc.invitacion;
drop table gesnoc.lista;
drop table gesnoc.evento;
drop table gesnoc.premio;
