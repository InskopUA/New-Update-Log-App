-- Team Invite Flow v1
-- Run this file in Supabase SQL Editor after supabase/schema.sql.

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

grant execute on function public.get_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_company_invite(text) to authenticated;
