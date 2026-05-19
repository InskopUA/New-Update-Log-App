-- Maintenance and Driver Signals v1
-- Run this file after supabase/report-workflow.sql.

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  truck_id uuid not null references public.trucks(id) on delete cascade,
  issue_type text not null check (issue_type in ('tires', 'engine', 'brakes', 'lights', 'inspection', 'oil_service', 'body', 'other')),
  status text not null default 'open' check (status in ('open', 'scheduled', 'in_repair', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  vendor text,
  estimated_cost numeric(10,2),
  actual_cost numeric(10,2),
  downtime_hours numeric(8,2) not null default 0 check (downtime_hours >= 0),
  opened_at date not null default current_date,
  scheduled_at date,
  completed_at date,
  next_follow_up_date date,
  notes text not null check (char_length(trim(notes)) >= 3),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  signal_type text not null check (signal_type in ('pay', 'fatigue', 'retention_risk', 'equipment', 'schedule', 'attitude', 'personal', 'positive', 'other')),
  tone text not null default 'neutral' check (tone in ('positive', 'neutral', 'concern', 'urgent')),
  note text not null check (char_length(trim(note)) >= 3),
  needs_follow_up boolean not null default false,
  due_date date,
  resolved_at timestamptz,
  resolution_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_logs_company_status_idx
  on public.maintenance_logs(company_id, status);

create index if not exists maintenance_logs_truck_idx
  on public.maintenance_logs(company_id, truck_id);

create index if not exists maintenance_logs_follow_up_idx
  on public.maintenance_logs(company_id, next_follow_up_date)
  where status in ('open', 'scheduled', 'in_repair');

create index if not exists driver_signals_company_follow_up_idx
  on public.driver_signals(company_id, needs_follow_up, resolved_at);

create index if not exists driver_signals_driver_idx
  on public.driver_signals(company_id, driver_id);

drop trigger if exists set_maintenance_logs_updated_at on public.maintenance_logs;
create trigger set_maintenance_logs_updated_at
before update on public.maintenance_logs
for each row execute function public.set_updated_at();

drop trigger if exists set_driver_signals_updated_at on public.driver_signals;
create trigger set_driver_signals_updated_at
before update on public.driver_signals
for each row execute function public.set_updated_at();

alter table public.maintenance_logs enable row level security;
alter table public.driver_signals enable row level security;

drop policy if exists "Company members can view maintenance logs" on public.maintenance_logs;
create policy "Company members can view maintenance logs"
on public.maintenance_logs
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Ops members can create maintenance logs" on public.maintenance_logs;
create policy "Ops members can create maintenance logs"
on public.maintenance_logs
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

drop policy if exists "Ops members can update maintenance logs" on public.maintenance_logs;
create policy "Ops members can update maintenance logs"
on public.maintenance_logs
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

drop policy if exists "Company members can view driver signals" on public.driver_signals;
create policy "Company members can view driver signals"
on public.driver_signals
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Ops members can create driver signals" on public.driver_signals;
create policy "Ops members can create driver signals"
on public.driver_signals
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

drop policy if exists "Ops members can update driver signals" on public.driver_signals;
create policy "Ops members can update driver signals"
on public.driver_signals
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));
