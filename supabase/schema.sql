-- DeepTruck SaaS Foundation v1
-- Run this file in Supabase SQL Editor before using the app.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('owner', 'admin', 'dispatcher', 'viewer');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'dispatcher',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'dispatcher',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists company_members_user_id_idx on public.company_members(user_id);
create index if not exists company_members_company_id_idx on public.company_members(company_id);
create index if not exists company_invites_company_id_idx on public.company_invites(company_id);
create index if not exists drivers_company_id_idx on public.drivers(company_id);
create index if not exists drivers_status_idx on public.drivers(company_id, status);
create index if not exists drivers_assigned_dispatcher_id_idx on public.drivers(assigned_dispatcher_id);
create index if not exists trucks_company_id_idx on public.trucks(company_id);
create index if not exists trucks_status_idx on public.trucks(company_id, status);
create index if not exists trucks_current_driver_id_idx on public.trucks(current_driver_id);
create unique index if not exists company_invites_pending_email_idx
  on public.company_invites(company_id, lower(email))
  where status = 'pending';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists set_company_members_updated_at on public.company_members;
create trigger set_company_members_updated_at
before update on public.company_members
for each row execute function public.set_updated_at();

drop trigger if exists set_company_invites_updated_at on public.company_invites;
create trigger set_company_invites_updated_at
before update on public.company_invites
for each row execute function public.set_updated_at();

drop trigger if exists set_drivers_updated_at on public.drivers;
create trigger set_drivers_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

drop trigger if exists set_trucks_updated_at on public.trucks;
create trigger set_trucks_updated_at
before update on public.trucks
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_company_member(target_company_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = target_user_id
      and cm.status = 'active'
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.role = any(allowed_roles)
      and cm.status = 'active'
  );
$$;

create or replace function public.shares_company_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members mine
    join public.company_members theirs on theirs.company_id = mine.company_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = target_user_id
      and theirs.status = 'active'
  );
$$;

create or replace function public.create_company(company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized_name := nullif(trim(company_name), '');

  if normalized_name is null then
    raise exception 'Company name is required';
  end if;

  insert into public.companies (name, slug, created_by)
  values (
    normalized_name,
    lower(regexp_replace(normalized_name, '[^a-zA-Z0-9]+', '-', 'g')),
    auth.uid()
  )
  returning id into new_company_id;

  insert into public.company_members (company_id, user_id, role, status)
  values (new_company_id, auth.uid(), 'owner', 'active');

  return new_company_id;
end;
$$;

create or replace function public.get_invite_by_token(invite_token text)
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  email text,
  role public.app_role,
  status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ci.id,
    ci.company_id,
    c.name as company_name,
    ci.email,
    ci.role,
    case
      when ci.status = 'pending' and ci.expires_at < now() then 'expired'
      else ci.status
    end as status,
    ci.expires_at
  from public.company_invites ci
  join public.companies c on c.id = ci.company_id
  where ci.token = invite_token
  limit 1;
$$;

create or replace function public.accept_company_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.company_invites%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select lower(coalesce(p.email, u.email, ''))
  into current_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();

  select *
  into invite_record
  from public.company_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if invite_record.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if invite_record.expires_at < now() then
    update public.company_invites
    set status = 'expired'
    where id = invite_record.id;

    raise exception 'Invite expired';
  end if;

  if lower(invite_record.email) <> current_email then
    raise exception 'Invite email does not match current user';
  end if;

  insert into public.company_members (company_id, user_id, role, status)
  values (invite_record.company_id, auth.uid(), invite_record.role, 'active')
  on conflict (company_id, user_id) do update
    set status = 'active',
        updated_at = now();

  update public.company_invites
  set status = 'accepted',
      accepted_by = auth.uid()
  where id = invite_record.id;

  return invite_record.company_id;
end;
$$;

create or replace function public.get_company_members(target_company_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role public.app_role,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cm.id,
    cm.user_id,
    p.email,
    p.full_name,
    cm.role,
    cm.status,
    cm.created_at
  from public.company_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.company_id = target_company_id
    and public.is_company_member(target_company_id)
  order by cm.created_at asc;
$$;

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

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invites enable row level security;
alter table public.drivers enable row level security;
alter table public.trucks enable row level security;

drop policy if exists "Profiles are visible to self and company members" on public.profiles;
create policy "Profiles are visible to self and company members"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.shares_company_with(id));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Members can view their companies" on public.companies;
create policy "Members can view their companies"
on public.companies
for select
to authenticated
using (public.is_company_member(id));

drop policy if exists "Owners and admins can update companies" on public.companies;
create policy "Owners and admins can update companies"
on public.companies
for update
to authenticated
using (public.has_company_role(id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(id, array['owner', 'admin']::public.app_role[]));

drop policy if exists "Members can view company memberships" on public.company_members;
create policy "Members can view company memberships"
on public.company_members
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Owners and admins can manage memberships" on public.company_members;
create policy "Owners and admins can manage memberships"
on public.company_members
for all
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

drop policy if exists "Owners and admins can view invites" on public.company_invites;
create policy "Owners and admins can view invites"
on public.company_invites
for select
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

drop policy if exists "Owners and admins can create invites" on public.company_invites;
create policy "Owners and admins can create invites"
on public.company_invites
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

drop policy if exists "Owners and admins can update invites" on public.company_invites;
create policy "Owners and admins can update invites"
on public.company_invites
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

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

grant execute on function public.create_company(text) to authenticated;
grant execute on function public.get_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_company_invite(text) to authenticated;
grant execute on function public.get_company_members(uuid) to authenticated;
grant execute on function public.get_drivers(uuid) to authenticated;
grant execute on function public.deactivate_driver(uuid) to authenticated;
grant execute on function public.get_trucks(uuid) to authenticated;
grant execute on function public.deactivate_truck(uuid) to authenticated;
grant execute on function public.is_company_member(uuid, uuid) to authenticated;
grant execute on function public.has_company_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.shares_company_with(uuid) to authenticated;
