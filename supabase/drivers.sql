-- Drivers v1
-- Run this file in Supabase SQL Editor after the SaaS foundation SQL.

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'inactive', 'on_hold')),
  driver_type text not null default 'company_driver' check (driver_type in ('company_driver', 'owner_operator', 'contractor')),
  assigned_dispatcher_id uuid references public.profiles(id) on delete set null,
  start_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drivers_company_id_idx on public.drivers(company_id);
create index if not exists drivers_status_idx on public.drivers(company_id, status);
create index if not exists drivers_assigned_dispatcher_id_idx on public.drivers(assigned_dispatcher_id);

drop trigger if exists set_drivers_updated_at on public.drivers;
create trigger set_drivers_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

create or replace function public.get_drivers(target_company_id uuid)
returns table (
  id uuid,
  company_id uuid,
  full_name text,
  phone text,
  email text,
  status text,
  driver_type text,
  assigned_dispatcher_id uuid,
  assigned_dispatcher_name text,
  start_date date,
  notes text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.company_id,
    d.full_name,
    d.phone,
    d.email,
    d.status,
    d.driver_type,
    d.assigned_dispatcher_id,
    p.full_name as assigned_dispatcher_name,
    d.start_date,
    d.notes,
    d.created_at
  from public.drivers d
  left join public.profiles p on p.id = d.assigned_dispatcher_id
  where d.company_id = target_company_id
    and public.is_company_member(target_company_id)
  order by
    case d.status when 'active' then 1 when 'on_hold' then 2 else 3 end,
    d.full_name asc;
$$;

create or replace function public.deactivate_driver(target_driver_id uuid)
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
  from public.drivers
  where id = target_driver_id;

  if target_company_id is null then
    raise exception 'Driver not found';
  end if;

  if not public.has_company_role(target_company_id, array['owner', 'admin']::public.app_role[]) then
    raise exception 'Not allowed';
  end if;

  update public.drivers
  set status = 'inactive'
  where id = target_driver_id;

  return target_driver_id;
end;
$$;

alter table public.drivers enable row level security;

drop policy if exists "Company members can view drivers" on public.drivers;
create policy "Company members can view drivers"
on public.drivers
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Ops members can create drivers" on public.drivers;
create policy "Ops members can create drivers"
on public.drivers
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

drop policy if exists "Owners and admins can update drivers" on public.drivers;
create policy "Owners and admins can update drivers"
on public.drivers
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

grant execute on function public.get_drivers(uuid) to authenticated;
grant execute on function public.deactivate_driver(uuid) to authenticated;
