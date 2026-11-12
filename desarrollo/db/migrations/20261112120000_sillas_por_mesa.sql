-- migrate:up

-- Sillas fijas de una mesa (pedido del Product Owner, 12 de noviembre de 2026). Si se indican, el
-- plano dibuja esa cantidad aunque la mesa se agrande o se achique; nulo dibuja las que caben según
-- su tamaño, como hasta ahora. La aplicación ya puede actualizar `mesa` (no está en la historia).
alter table gesnoc.mesa
  add column sillas smallint constraint mesa_sillas_ck check (sillas between 0 and 20);

comment on column gesnoc.mesa.sillas is
  'Sillas fijas de la mesa; nulo dibuja las que caben según su tamaño. [RF-06]';

-- migrate:down

alter table gesnoc.mesa drop column sillas;
