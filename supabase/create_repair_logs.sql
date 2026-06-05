-- Crear tabla de logs para auditoría de cambios en reparaciones
create table if not exists public.repair_logs (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete cascade,
  action text not null check (action in ('created', 'updated', 'deleted', 'status_changed')),
  changed_fields jsonb not null default '{}'::jsonb,
  old_data jsonb,
  new_data jsonb,
  repair_label text,
  created_at timestamptz not null default now()
);

-- Crear índices para mejor rendimiento
create index if not exists repair_logs_repair_id_idx on public.repair_logs (repair_id);
create index if not exists repair_logs_created_at_idx on public.repair_logs (created_at desc);
create index if not exists repair_logs_action_idx on public.repair_logs (action);

-- Habilitar RLS
alter table public.repair_logs enable row level security;

-- Política para permitir lectura anónima
drop policy if exists "anon can read repair_logs" on public.repair_logs;
create policy "anon can read repair_logs"
on public.repair_logs
for select
to anon
using (true);

-- Política para permitir inserción anónima (para triggers)
drop policy if exists "anon can insert repair_logs" on public.repair_logs;
create policy "anon can insert repair_logs"
on public.repair_logs
for insert
to anon
with check (true);

-- Función para detectar cambios entre dos JSONB
create or replace function public.get_changed_fields(old jsonb, new jsonb)
returns jsonb
language plpgsql
as $$
declare
  changed jsonb := '{}'::jsonb;
  key text;
begin
  for key in select jsonb_object_keys(new)
  loop
    if old->key is distinct from new->key then
      changed := jsonb_set(changed, array[key], jsonb_build_object(
        'old', old->key,
        'new', new->key
      ));
    end if;
  end loop;
  return changed;
end;
$$;

-- Función para crear log cuando se inserta una reparación
create or replace function public.log_repair_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.repair_logs (
    repair_id,
    action,
    changed_fields,
    new_data,
    repair_label
  )
  values (
    new.id,
    'created',
    '{}'::jsonb,
    to_jsonb(new),
    new.nombre || ' ' || new.apellido || ' - ' || new.marca || ' ' || new.modelo
  );
  return new;
end;
$$;

-- Función para crear log cuando se actualiza una reparación
create or replace function public.log_repair_update()
returns trigger
language plpgsql
as $$
declare
  changed_fields jsonb;
  is_status_change boolean;
begin
  changed_fields := public.get_changed_fields(to_jsonb(old), to_jsonb(new));
  
  -- Si no hay cambios, no crear log
  if changed_fields = '{}'::jsonb then
    return new;
  end if;
  
  -- Detectar si el cambio es de estado
  is_status_change := changed_fields ? 'estado';
  
  insert into public.repair_logs (
    repair_id,
    action,
    changed_fields,
    old_data,
    new_data,
    repair_label
  )
  values (
    new.id,
    case when is_status_change then 'status_changed' else 'updated' end,
    changed_fields,
    to_jsonb(old),
    to_jsonb(new),
    new.nombre || ' ' || new.apellido || ' - ' || new.marca || ' ' || new.modelo
  );
  
  return new;
end;
$$;

-- Función para crear log cuando se elimina una reparación
create or replace function public.log_repair_delete()
returns trigger
language plpgsql
as $$
begin
  insert into public.repair_logs (
    repair_id,
    action,
    changed_fields,
    old_data,
    repair_label
  )
  values (
    old.id,
    'deleted',
    '{}'::jsonb,
    to_jsonb(old),
    old.nombre || ' ' || old.apellido || ' - ' || old.marca || ' ' || old.modelo
  );
  return old;
end;
$$;

-- Crear triggers
drop trigger if exists repair_insert_log on public.repairs;
create trigger repair_insert_log
after insert on public.repairs
for each row execute function public.log_repair_insert();

drop trigger if exists repair_update_log on public.repairs;
create trigger repair_update_log
after update on public.repairs
for each row execute function public.log_repair_update();

drop trigger if exists repair_delete_log on public.repairs;
create trigger repair_delete_log
before delete on public.repairs
for each row execute function public.log_repair_delete();
