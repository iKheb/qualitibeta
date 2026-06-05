-- Modificar tabla repair_logs para permitir logs de expenses
alter table public.repair_logs
  add column if not exists expense_id uuid,
  add column if not exists table_name text not null default 'repairs';

-- Crear índice para expense_id
create index if not exists repair_logs_expense_id_idx on public.repair_logs (expense_id);

-- Hacer repair_id nullable para permitir logs de eliminación
alter table public.repair_logs
  alter column repair_id drop not null;

-- Eliminar la restricción foreign key completamente (los logs son históricos y no necesitan integridad referencial estricta)
alter table public.repair_logs
  drop constraint if exists repair_logs_repair_id_fkey;

-- Modificar el constraint de check para permitir más acciones
alter table public.repair_logs
  drop constraint if exists repair_logs_action_check;
alter table public.repair_logs
  add constraint repair_logs_action_check
  check (action in ('created', 'updated', 'deleted', 'status_changed'));

-- Función para crear log cuando se inserta un gasto
create or replace function public.log_expense_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.repair_logs (
    repair_id,
    expense_id,
    table_name,
    action,
    changed_fields,
    new_data,
    repair_label
  )
  values (
    null,
    new.id,
    'expenses',
    'created',
    '{}'::jsonb,
    to_jsonb(new),
    'Gasto: ' || new.concepto
  );
  return new;
end;
$$;

-- Función para crear log cuando se actualiza un gasto
create or replace function public.log_expense_update()
returns trigger
language plpgsql
as $$
declare
  changed_fields jsonb;
begin
  changed_fields := public.get_changed_fields(to_jsonb(old), to_jsonb(new));
  
  -- Si no hay cambios, no crear log
  if changed_fields = '{}'::jsonb then
    return new;
  end if;
  
  insert into public.repair_logs (
    repair_id,
    expense_id,
    table_name,
    action,
    changed_fields,
    old_data,
    new_data,
    repair_label
  )
  values (
    null,
    new.id,
    'expenses',
    'updated',
    changed_fields,
    to_jsonb(old),
    to_jsonb(new),
    'Gasto: ' || new.concepto
  );
  
  return new;
end;
$$;

-- Función para crear log cuando se elimina un gasto
create or replace function public.log_expense_delete()
returns trigger
language plpgsql
as $$
begin
  insert into public.repair_logs (
    repair_id,
    expense_id,
    table_name,
    action,
    changed_fields,
    old_data,
    repair_label
  )
  values (
    null,
    old.id,
    'expenses',
    'deleted',
    '{}'::jsonb,
    to_jsonb(old),
    'Gasto: ' || old.concepto
  );
  return old;
end;
$$;

-- Crear triggers para expenses
drop trigger if exists expense_insert_log on public.expenses;
create trigger expense_insert_log
after insert on public.expenses
for each row execute function public.log_expense_insert();

drop trigger if exists expense_update_log on public.expenses;
create trigger expense_update_log
after update on public.expenses
for each row execute function public.log_expense_update();

drop trigger if exists expense_delete_log on public.expenses;
create trigger expense_delete_log
before delete on public.expenses
for each row execute function public.log_expense_delete();

-- Corregir trigger de eliminación de repairs para usar AFTER DELETE
drop trigger if exists repair_delete_log on public.repairs;
create trigger repair_delete_log
after delete on public.repairs
for each row execute function public.log_repair_delete();
