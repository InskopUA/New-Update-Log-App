-- Trucks v1
-- Run this file in Supabase SQL Editor after supabase/drivers.sql.

create table if not exists public.trucks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_number text not null,
  vin text,
  make text,
  model text,
  year integer check (year is null or (year >= 1980 and year <= 2100)),
  plate_number text,
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  current_driver_id uuid references public.drivers(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, unit_number)
);

create index if not exists trucks_company_id_idx on public.trucks(company_id);
create index if not exists trucks_status_idx on public.trucks(company_id, status);
create index if not exists trucks_current_driver_id_idx on public.trucks(current_driver_id);

drop trigger if exists set_trucks_updated_at on public.trucks;
create trigger set_trucks_updated_at
before update on public.trucks
for each row execute function public.set_updated_at();

create or replace function public.get_trucks(target_company_id uuid)
returns table (
  id uuid,
  company_id uuid,
  unit_number text,
  vin text,
  make text,
  model text,
  year integer,
  plate_number text,
  status text,
  current_driver_id uuid,
  current_driver_name text,
  notes text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.company_id,
    t.unit_number,
    t.vin,
    t.make,
    t.model,
    t.year,
    t.plate_number,
    t.status,
    t.current_driver_id,
    d.full_name as current_driver_name,
    t.notes,
    t.created_at
  from public.trucks t
  left join public.drivers d on d.id = t.current_driver_id
  where t.company_id = target_company_id
    and public.is_company_member(target_company_id)
  order by
    case t.status when 'active' then 1 when 'maintenance' then 2 else 3 end,
    t.unit_number asc;
$$;

create or replace function public.deactivate_truck(target_truck_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select company_id
  into target_company_id
  from public.trucks
  where id = target_truck_id;

  if target_company_id is null then
    raise exception 'Truck not found';
  end if;

  if not public.has_company_role(target_company_id, array['owner', 'admin']::public.app_role[]) then
    raise exception 'Not allowed';
  end if;

  update public.trucks
  set status = 'inactive'
  where id = target_truck_id;

  return target_truck_id;
end;
$$;

alter table public.trucks enable row level security;

drop policy if exists "Company members can view trucks" on public.trucks;
create policy "Company members can view trucks"
on public.trucks
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Ops members can create trucks" on public.trucks;
create policy "Ops members can create trucks"
on public.trucks
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

drop policy if exists "Owners and admins can update trucks" on public.trucks;
create policy "Owners and admins can update trucks"
on public.trucks
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

grant execute on function public.get_trucks(uuid) to authenticated;
grant execute on function public.deactivate_truck(uuid) to authenticated;
