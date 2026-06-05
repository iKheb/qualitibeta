alter table public.repairs
  add column if not exists recibido_por text not null default '',
  add column if not exists clave_equipo text not null default '',
  add column if not exists patron_equipo jsonb not null default '[]'::jsonb;

alter table public.repairs drop constraint if exists repairs_estado_check;
alter table public.repairs
  add constraint repairs_estado_check
  check (estado in ('Recibido', 'Reparado', 'Garantia', 'Entregado', 'Devuelto'));
