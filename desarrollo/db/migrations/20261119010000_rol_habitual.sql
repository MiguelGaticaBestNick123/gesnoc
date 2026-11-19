-- migrate:up

-- Rol habitual de cada persona (pedido del Product Owner, 18 de noviembre de 2026). El rol se decide
-- cada noche, pero cada persona suele hacer uno (Pato, barra) o dos (Matías, barra y garzón). La
-- administración lo define en la cuenta y la asignación de turnos recomienda a cada persona para su
-- rol habitual y para el alternativo. Sin rol definido, se sigue deduciendo de su historial.
alter table gesnoc.usuario
  add column rol_habitual    text constraint usuario_rol_habitual_check
    check (rol_habitual in ('garzon', 'barman', 'cocinero', 'guardia')),
  add column rol_alternativo text constraint usuario_rol_alternativo_check
    check (rol_alternativo in ('garzon', 'barman', 'cocinero', 'guardia')),
  add constraint usuario_roles_ck check (
    rol_alternativo is null or (rol_habitual is not null and rol_alternativo <> rol_habitual));

comment on column gesnoc.usuario.rol_habitual is
  'Rol que la persona suele hacer; la asignación de turnos la recomienda para él. [RF-03, RF-12]';
comment on column gesnoc.usuario.rol_alternativo is
  'Otro rol que también suele hacer (ej. barra y garzón); nulo si tiene uno solo. [RF-03, RF-12]';

-- migrate:down

alter table gesnoc.usuario
  drop constraint usuario_roles_ck,
  drop column rol_alternativo,
  drop column rol_habitual;
