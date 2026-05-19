-- Report Workflow v1
-- Run this file after supabase/reports.sql to add resolution, impact, and follow-up fields.

alter table public.operational_reports
  add column if not exists status text,
  add column if not exists estimated_cost numeric(10,2),
  add column if not exists follow_up_required boolean,
  add column if not exists root_cause text,
  add column if not exists location text,
  add column if not exists customer_or_broker text,
  add column if not exists resolution_note text,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_reports_status_check'
  ) then
    alter table public.operational_reports
      add constraint operational_reports_status_check
      check (status in ('open', 'in_progress', 'resolved', 'no_action'));
  end if;
end $$;

create index if not exists operational_reports_status_idx
  on public.operational_reports(company_id, status);

create index if not exists operational_reports_follow_up_idx
  on public.operational_reports(company_id, follow_up_required)
  where follow_up_required = true;

create or replace function public.set_operational_report_workflow_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.estimated_cost is null then
    new.estimated_cost = round(coalesce(new.downtime_hours, 0) * 180, 2);
  end if;

  if new.follow_up_required is null then
    new.follow_up_required =
      new.issue_type <> 'no_problem'
      and new.severity in ('high', 'critical');
  end if;

  if new.status is null then
    new.status = case
      when new.issue_type = 'no_problem' then 'no_action'
      else 'open'
    end;
  end if;

  if new.status = 'resolved' and new.resolved_at is null then
    new.resolved_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_operational_report_workflow_defaults on public.operational_reports;
create trigger set_operational_report_workflow_defaults
before insert or update on public.operational_reports
for each row execute function public.set_operational_report_workflow_defaults();

update public.operational_reports
set
  estimated_cost = coalesce(estimated_cost, round(coalesce(downtime_hours, 0) * 180, 2)),
  follow_up_required = coalesce(
    follow_up_required,
    issue_type <> 'no_problem' and severity in ('high', 'critical')
  ),
  status = coalesce(
    status,
    case when issue_type = 'no_problem' then 'no_action' else 'open' end
  );

create or replace function public.set_operational_report_status(
  target_report_id uuid,
  new_status text,
  resolution_note_input text default null
)
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

  if new_status not in ('in_progress', 'resolved') then
    raise exception 'Invalid report status';
  end if;

  select company_id
  into target_company_id
  from public.operational_reports
  where id = target_report_id;

  if target_company_id is null then
    raise exception 'Report not found';
  end if;

  if not public.has_company_role(
    target_company_id,
    array['owner', 'admin', 'dispatcher']::public.app_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  update public.operational_reports
  set
    status = new_status,
    resolution_note = case
      when resolution_note_input is null or trim(resolution_note_input) = '' then resolution_note
      else trim(resolution_note_input)
    end,
    resolved_by = case when new_status = 'resolved' then auth.uid() else resolved_by end,
    resolved_at = case when new_status = 'resolved' then now() else resolved_at end
  where id = target_report_id;

  return target_report_id;
end;
$$;

drop function if exists public.get_operational_reports(uuid, date, date);

create function public.get_operational_reports(
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
  estimated_cost numeric,
  follow_up_required boolean,
  status text,
  root_cause text,
  location text,
  customer_or_broker text,
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
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
    r.estimated_cost,
    r.follow_up_required,
    r.status,
    r.root_cause,
    r.location,
    r.customer_or_broker,
    r.resolution_note,
    r.resolved_by,
    r.resolved_at,
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

grant execute on function public.set_operational_report_status(uuid, text, text) to authenticated;
grant execute on function public.get_operational_reports(uuid, date, date) to authenticated;
