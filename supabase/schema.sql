create extension if not exists pgcrypto;

create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  fecha_ingreso timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  fecha_entregado timestamptz,
  nombre text not null,
  apellido text not null,
  cedula text,
  telefono text,
  direccion text,
  recibido_por text not null default '',
  marca text not null,
  modelo text not null,
  reparacion text not null,
  observaciones text not null,
  dias_garantia integer not null default 0,
  precio numeric(14, 2) not null default 0,
  clave_equipo text not null default '',
  patron_equipo jsonb not null default '[]'::jsonb,
  estado text not null default 'Recibido' check (estado in ('Recibido', 'Reparado', 'Garantia', 'Entregado', 'Devuelto')),
  estado_recepcion text not null default 'Encendido',
  fotos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.repairs
  add column if not exists recibido_por text not null default '',
  add column if not exists clave_equipo text not null default '',
  add column if not exists patron_equipo jsonb not null default '[]'::jsonb;

alter table public.repairs drop constraint if exists repairs_estado_check;
alter table public.repairs
  add constraint repairs_estado_check
  check (estado in ('Recibido', 'Reparado', 'Garantia', 'Entregado', 'Devuelto'));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  concepto text not null,
  monto numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_repairs_updated_at on public.repairs;
create trigger set_repairs_updated_at
before update on public.repairs
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create index if not exists repairs_fecha_ingreso_idx on public.repairs (fecha_ingreso desc);
create index if not exists repairs_estado_idx on public.repairs (estado);
create index if not exists repairs_fecha_entregado_idx on public.repairs (fecha_entregado desc);
create index if not exists expenses_fecha_idx on public.expenses (fecha desc);

alter table public.repairs enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "anon can manage repairs" on public.repairs;
create policy "anon can manage repairs"
on public.repairs
for all
to anon
using (true)
with check (true);

drop policy if exists "anon can manage expenses" on public.expenses;
create policy "anon can manage expenses"
on public.expenses
for all
to anon
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'repair-photos',
  'repair-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon can read repair photos" on storage.objects;
create policy "anon can read repair photos"
on storage.objects
for select
to anon
using (bucket_id = 'repair-photos');

drop policy if exists "anon can upload repair photos" on storage.objects;
create policy "anon can upload repair photos"
on storage.objects
for insert
to anon
with check (bucket_id = 'repair-photos');

drop policy if exists "anon can update repair photos" on storage.objects;
create policy "anon can update repair photos"
on storage.objects
for update
to anon
using (bucket_id = 'repair-photos')
with check (bucket_id = 'repair-photos');

drop policy if exists "anon can delete repair photos" on storage.objects;
create policy "anon can delete repair photos"
on storage.objects
for delete
to anon
using (bucket_id = 'repair-photos');
