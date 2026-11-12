-- migrate:up

-- La cocina es una estación del local, no de un ambiente (pedido del Product Owner, 12 de noviembre
-- de 2026): recibe la comida de todos los ambientes. Solo la barra pertenece a un ambiente, y a lo
-- más una por ambiente (RN-27). Por lo mismo, el turno de cocina no lleva ambiente: solo garzón y
-- barra trabajan en uno, y solo ellos reciben las propinas del suyo (RN-04).
alter table gesnoc.estacion alter column ambiente_id drop not null;
update gesnoc.estacion set ambiente_id = null where tipo = 'cocina';
alter table gesnoc.estacion
  add constraint estacion_ambiente_ck check ((tipo = 'barra') = (ambiente_id is not null));

alter table gesnoc.asignacion drop constraint asignacion_ambiente_ck;
update gesnoc.asignacion set ambiente_id = null where rol = 'cocinero';
alter table gesnoc.asignacion
  add constraint asignacion_ambiente_ck
  check ((rol in ('garzon', 'barman')) = (ambiente_id is not null));

comment on column gesnoc.estacion.ambiente_id is
  'Ambiente de la barra; la cocina no tiene ambiente y recibe la comida de todos. [RF-07, RF-18]';
comment on column gesnoc.asignacion.ambiente_id is
  'Ambiente del turno de garzón o barra; nulo para cocina y guardia, que trabajan para todo el local. [RF-04, RF-12]';

-- migrate:down

alter table gesnoc.asignacion drop constraint asignacion_ambiente_ck;
update gesnoc.asignacion set ambiente_id = (select min(id) from gesnoc.ambiente)
  where rol = 'cocinero';
alter table gesnoc.asignacion
  add constraint asignacion_ambiente_ck check ((rol = 'guardia') = (ambiente_id is null));

alter table gesnoc.estacion drop constraint estacion_ambiente_ck;
update gesnoc.estacion set ambiente_id = (select min(id) from gesnoc.ambiente)
  where ambiente_id is null;
alter table gesnoc.estacion alter column ambiente_id set not null;

comment on column gesnoc.estacion.ambiente_id is
  'Ambiente donde está la estación; define la barra del ambiente. [RF-07, RF-18]';
comment on column gesnoc.asignacion.ambiente_id is
  'Ambiente del turno; nulo solo para guardia (trabaja en la puerta). [RF-04, RF-12]';
