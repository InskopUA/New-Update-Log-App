-- Operational Reports v1
-- Run this file in Supabase SQL Editor after drivers/trucks SQL.

create table if not exists public.operational_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_date date not null default current_date,
  category text not null check (category in ('truck_status', 'driver', 'load', 'other')),
  issue_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  driver_id uuid references public.drivers(id) on delete set null,
  truck_id uuid references public.trucks(id) on delete set null,
  load_reference text,
  downtime_hours numeric(6,2) not null default 0 check (downtime_hours >= 0),
  explanation text not null check (char_length(trim(explanation)) >= 10),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_reports_company_date_idx on public.operational_reports(company_id, report_date desc);
create index if not exists operational_reports_driver_idx on public.operational_reports(company_id, driver_id);
create index if not exists operational_reports_truck_idx on public.operational_reports(company_id, truck_id);
create index if not exists operational_reports_category_idx on public.operational_reports(company_id, category);
create index if not exists operational_reports_severity_idx on public.operational_reports(company_id, severity);

drop trigger if exists set_operational_reports_updated_at on public.operational_reports;
create trigger set_operational_reports_updated_at
before update on public.operational_reports
for each row execute function public.set_updated_at();

create or replace function public.get_operational_reports(
  target_company_id uuid,
  start_date date default null,
  end_date date default null
)
returns table (
  id uuid,
  company_id uuid,
  report_date date,
  category text,
  issue_type text,
  severity text,
  driver_id uuid,
  driver_name text,
  truck_id uuid,
  truck_unit_number text,
  load_reference text,
  downtime_hours numeric,
  explanation text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.company_id,
    r.report_date,
    r.category,
    r.issue_type,
    r.severity,
    r.driver_id,
    d.full_name as driver_name,
    r.truck_id,
    t.unit_number as truck_unit_number,
    r.load_reference,
    r.downtime_hours,
    r.explanation,
    r.created_by,
    p.full_name as created_by_name,
    r.created_at
  from public.operational_reports r
  left join public.drivers d on d.id = r.driver_id
  left join public.trucks t on t.id = r.truck_id
  left join public.profiles p on p.id = r.created_by
  where r.company_id = target_company_id
    and public.is_company_member(target_company_id)
    and (start_date is null or r.report_date >= start_date)
    and (end_date is null or r.report_date <= end_date)
  order by r.report_date desc, r.created_at desc;
$$;

alter table public.operational_reports enable row level security;

drop policy if exists "Company members can view operational reports" on public.operational_reports;
create policy "Company members can view operational reports"
on public.operational_reports
for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Ops members can create operational reports" on public.operational_reports;
create policy "Ops members can create operational reports"
on public.operational_reports
for insert
to authenticated
with check (public.has_company_role(company_id, array['owner', 'admin', 'dispatcher']::public.app_role[]));

drop policy if exists "Owners and admins can update operational reports" on public.operational_reports;
create policy "Owners and admins can update operational reports"
on public.operational_reports
for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.app_role[]));

grant execute on function public.get_operational_reports(uuid, date, date) to authenticated;
