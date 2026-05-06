-- Team Members Listing
-- Run this file in Supabase SQL Editor if your existing DB already has the foundation schema.

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

grant execute on function public.get_company_members(uuid) to authenticated;
