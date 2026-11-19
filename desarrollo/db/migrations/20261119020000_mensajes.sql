-- migrate:up

-- Chat del personal (pedido del Product Owner, 18 de noviembre de 2026): un canal general que ven
-- todos los que trabajan la noche y uno por rol (garzones, barra, cocina, guardias), para avisar algo
-- rápido sin moverse de su puesto. Los mensajes son de la noche abierta y se numeran dentro de ella,
-- como los pedidos. Cada persona lee y escribe en el general y en el de su rol; la administración,
-- en todos. Un reintento tras un corte de red no duplica el mensaje: lo reconoce su clave de envío.
create table gesnoc.mensaje (
  fecha       date        not null references gesnoc.noche (fecha),
  numero      integer     not null check (numero > 0),
  canal       text        not null
    check (canal in ('general', 'garzon', 'barman', 'cocinero', 'guardia')),
  autor_id    integer     not null references gesnoc.usuario (id),
  texto       text        not null check (length(trim(texto)) between 1 and 500),
  clave_envio uuid        not null,
  enviado_en  timestamptz not null default now(),
  primary key (fecha, numero),
  constraint mensaje_clave_envio_uq unique (clave_envio)
);
-- Cada teléfono pide los mensajes nuevos de sus canales cada pocos segundos.
create index mensaje_canal_ix on gesnoc.mensaje (fecha, canal, numero);
create index mensaje_autor_ix on gesnoc.mensaje (autor_id);

-- Lo que se escribió queda: la aplicación no edita ni borra mensajes.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'gesnoc_app') then
    revoke update, delete on gesnoc.mensaje from gesnoc_app;
  end if;
end
$$;

comment on table gesnoc.mensaje is
  'Mensaje del chat del personal en una noche, al canal general o al de un rol. [RF-04]';
comment on column gesnoc.mensaje.fecha is 'Noche del mensaje (noche.fecha). [RF-04]';
comment on column gesnoc.mensaje.numero is 'Correlativo del mensaje en la noche. [RF-04]';
comment on column gesnoc.mensaje.canal is 'general, o el rol que lo lee: garzon, barman, cocinero o guardia. [RF-04]';
comment on column gesnoc.mensaje.autor_id is 'Quién lo escribió (usuario.id). [RF-04]';
comment on column gesnoc.mensaje.texto is 'El mensaje, de 1 a 500 caracteres. [RF-04]';
comment on column gesnoc.mensaje.clave_envio is 'UUID del envío: un reintento no lo duplica (RN-13). [RF-04]';
comment on column gesnoc.mensaje.enviado_en is 'Hora del mensaje. [RF-04]';

-- migrate:down

drop table gesnoc.mensaje;
