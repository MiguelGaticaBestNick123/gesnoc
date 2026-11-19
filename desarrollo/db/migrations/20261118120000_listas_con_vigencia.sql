-- migrate:up

-- Listas con vigencia (pedido del Product Owner, 18 de noviembre de 2026). Hay listas de una noche
-- (un cumpleaños), de varias (los bailarines de una temporada) y sin término (los clientes
-- frecuentes: conocidos de la administración y habituales que se ganaron entrar gratis), y se
-- editan mientras están vigentes. La lista deja de ser parte de una noche: vale desde `desde` hasta
-- `hasta`, o sin término si `hasta` es nulo. Sus personas pasan a `integrante`, e `invitacion`
-- queda para las invitaciones individuales, que siguen siendo de una noche.
--
-- La entrada guarda con qué lista la puerta reconoció a la persona (`entrada.lista_id`, HU-33 CA2):
-- una lista de varias noches cambia, y sacar a alguien de ella no debe borrar cómo entró antes
-- (HU-34 CA2). Las listas que terminaron hace más de 12 meses se borran al cerrar una noche, con
-- sus integrantes, y esas entradas pierden el vínculo (RN-25, RNF-11).

-- 1. Identificador propio y vigencia. Las listas que ya existen eran de una noche.
alter table gesnoc.lista
  add column id    integer generated always as identity,
  add column desde date,
  add column hasta date;
update gesnoc.lista set desde = fecha, hasta = fecha;

-- 2. Las personas de cada lista, que hasta ahora eran invitaciones de su noche.
create table gesnoc.integrante (
  lista_id  integer not null,
  documento text    not null check (documento ~ '^[0-9A-Z]{4,15}(-[0-9K])?$'),
  nombre    text    not null check (length(trim(nombre)) between 1 and 60),
  apellido  text    not null check (length(trim(apellido)) between 1 and 60),
  primary key (lista_id, documento)
);
insert into gesnoc.integrante (lista_id, documento, nombre, apellido)
select l.id, i.documento, i.nombre, i.apellido
from gesnoc.invitacion i
join gesnoc.lista l on l.fecha = i.fecha and l.numero = i.lista_numero;

-- 3. La entrada de quien ya vino en una lista queda vinculada a ella.
alter table gesnoc.entrada add column lista_id integer;
update gesnoc.entrada e
set lista_id = l.id
from gesnoc.cliente c, gesnoc.invitacion i, gesnoc.lista l
where c.id = e.cliente_id
  and i.fecha = e.fecha and i.documento = c.documento
  and l.fecha = i.fecha and l.numero = i.lista_numero;

-- 4. La invitación queda solo individual: de una noche, con quién invita y si entra gratis.
delete from gesnoc.invitacion where lista_numero is not null;
alter table gesnoc.invitacion
  drop constraint invitacion_origen_ck,
  drop constraint invitacion_lista_fk,
  drop column lista_numero,
  alter column invitado_por set not null,
  alter column gratis set not null;

-- 5. La lista ya no es parte de una noche: su clave es su identificador.
alter table gesnoc.lista drop constraint lista_pkey;
drop index gesnoc.lista_nombre_uq;
alter table gesnoc.lista
  drop column fecha,
  drop column numero,
  alter column desde set not null,
  add constraint lista_pkey primary key (id),
  add constraint lista_vigencia_ck check (hasta is null or hasta >= desde);

alter table gesnoc.integrante
  add constraint integrante_lista_id_fkey
    foreign key (lista_id) references gesnoc.lista (id) on delete cascade;
-- La puerta reconoce a una persona por su documento (RN-21), sin saber en qué lista viene.
create index integrante_documento_ix on gesnoc.integrante (documento);

-- Al borrar una lista sus entradas pierden el vínculo. Solo pasa al anonimizar: la aplicación no
-- elimina una lista con la que alguien entró. La acción de la clave foránea corre con los permisos
-- del dueño de la tabla, así que la aplicación sigue sin poder modificar una entrada.
alter table gesnoc.entrada
  add constraint entrada_lista_id_fkey
    foreign key (lista_id) references gesnoc.lista (id) on delete set null;
create index entrada_lista_ix on gesnoc.entrada (lista_id) where lista_id is not null;

comment on table gesnoc.lista is
  'Lista de personas que la puerta reconoce mientras está vigente: de una noche (cumpleaños), de varias (bailarines) o sin término (clientes frecuentes). [RF-39]';
comment on column gesnoc.lista.id is 'Identificador de la lista. [RF-39]';
comment on column gesnoc.lista.nombre is 'Nombre de la lista (ej. Cumpleaños de Camila, Clientes frecuentes). [RF-39]';
comment on column gesnoc.lista.desde is 'Primera noche en que la lista vale. [RF-39]';
comment on column gesnoc.lista.hasta is 'Última noche en que la lista vale; nulo si no tiene término. [RF-39]';

comment on table gesnoc.integrante is
  'Persona de una lista: la puerta la reconoce por su documento mientras la lista esté vigente. Dato personal. [RF-39, RF-29]';
comment on column gesnoc.integrante.lista_id is 'Lista de la que forma parte. [RF-39]';
comment on column gesnoc.integrante.documento is 'Documento normalizado como el de cliente (RN-21). [RF-29, RF-39]';
comment on column gesnoc.integrante.nombre is 'Nombre, para registrarla sin escribirlo en la puerta. [RF-29, RF-39]';
comment on column gesnoc.integrante.apellido is 'Apellido, para registrarla sin escribirlo en la puerta. [RF-29, RF-39]';

comment on table gesnoc.invitacion is
  'Persona invitada individualmente a una noche (ej. un amigo del DJ). Dato personal. [RF-39, RF-29]';
comment on column gesnoc.invitacion.invitado_por is 'Quién la invitó (ej. DJ, administración). [RF-39]';
comment on column gesnoc.invitacion.gratis is 'Si entra gratis. [RF-39, RF-30]';

comment on column gesnoc.entrada.lista_id is
  'Lista con que la puerta reconoció a la persona; nulo si no venía en una o si la lista se borró al anonimizar. [RF-39, RF-30]';

-- migrate:down

-- Vuelve a las listas de una noche. Una lista de varias noches o sin término queda como lista de su
-- primera noche, si esa noche está programada; las demás se pierden con sus integrantes. El vínculo
-- de la entrada vuelve a deducirse del documento.
alter table gesnoc.lista add column fecha date, add column numero smallint;
update gesnoc.lista l
set fecha = l.desde, numero = n.numero
from (select id, row_number() over (partition by desde order by id) as numero
      from gesnoc.lista) n
where n.id = l.id;
delete from gesnoc.lista l
where l.numero > 99
   or not exists (select 1 from gesnoc.noche n where n.fecha = l.fecha)
   or exists (select 1 from gesnoc.lista o
              where o.fecha = l.fecha and lower(o.nombre) = lower(l.nombre) and o.id < l.id);

alter table gesnoc.invitacion
  add column lista_numero smallint,
  alter column invitado_por drop not null,
  alter column gratis drop not null;
insert into gesnoc.invitacion (fecha, documento, nombre, apellido, lista_numero)
select l.fecha, g.documento, g.nombre, g.apellido, l.numero
from gesnoc.integrante g
join gesnoc.lista l on l.id = g.lista_id
on conflict (fecha, documento) do nothing;

drop table gesnoc.integrante;
alter table gesnoc.entrada drop column lista_id;

alter table gesnoc.lista drop constraint lista_pkey;
alter table gesnoc.lista
  drop constraint lista_vigencia_ck,
  drop column id,
  drop column desde,
  drop column hasta,
  alter column fecha set not null,
  alter column numero set not null,
  add constraint lista_pkey primary key (fecha, numero),
  add constraint lista_fecha_fkey
    foreign key (fecha) references gesnoc.noche (fecha) on delete cascade,
  add constraint lista_numero_check check (numero between 1 and 99);
create unique index lista_nombre_uq on gesnoc.lista (fecha, lower(nombre));

alter table gesnoc.invitacion
  add constraint invitacion_lista_fk foreign key (fecha, lista_numero)
    references gesnoc.lista (fecha, numero) on delete cascade,
  add constraint invitacion_origen_ck check (
    (lista_numero is null) = (invitado_por is not null)
    and (lista_numero is null) = (gratis is not null));
create index invitacion_lista_ix on gesnoc.invitacion (fecha, lista_numero)
  where lista_numero is not null;

comment on table gesnoc.lista is
  'Grupo que una persona organiza para una noche (cumpleaños, bailarines). [RF-39]';
comment on column gesnoc.lista.fecha is 'Noche de la lista (noche.fecha). [RF-39]';
comment on column gesnoc.lista.numero is 'Discriminador de la lista dentro de la noche. [RF-39]';
comment on column gesnoc.lista.nombre is 'Nombre único en la noche (ej. Cumpleaños de Camila). [RF-39]';
comment on table gesnoc.invitacion is
  'Persona esperada en la puerta una noche, de una lista o invitada por alguien. Dato personal. [RF-39, RF-29]';
comment on column gesnoc.invitacion.lista_numero is 'Lista de la que forma parte; nulo si es una invitación individual. [RF-39]';
comment on column gesnoc.invitacion.invitado_por is 'Quién la invitó (ej. DJ, administración); solo en invitaciones individuales. [RF-39]';
comment on column gesnoc.invitacion.gratis is 'Si entra gratis; solo en invitaciones individuales (en una lista, lo dice la lista). [RF-39, RF-30]';
