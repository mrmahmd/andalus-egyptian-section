-- Explicit supervisor-to-teacher links.
-- This keeps the review scope correct even if departments change later.

create table if not exists public.supervisor_staff_links (
  id uuid primary key default gen_random_uuid(),
  supervisor_staff_id uuid not null references public.staff_directory(id) on delete cascade,
  teacher_staff_id uuid not null references public.staff_directory(id) on delete cascade,
  assigned_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (supervisor_staff_id, teacher_staff_id),
  check (supervisor_staff_id <> teacher_staff_id)
);

create index if not exists supervisor_staff_links_supervisor_idx on public.supervisor_staff_links (supervisor_staff_id);
create index if not exists supervisor_staff_links_teacher_idx on public.supervisor_staff_links (teacher_staff_id);

-- Seed the agreed school structure: every teacher in English, Arabic/Social,
-- and Math/Science is linked to the supervisor registered for that department.
insert into public.supervisor_staff_links (supervisor_staff_id, teacher_staff_id)
select supervisor.id, teacher.id
from public.staff_directory supervisor
join public.staff_directory teacher
  on teacher.department_id = supervisor.department_id
 and teacher.account_kind = 'teacher'
where supervisor.account_kind = 'admin'
  and supervisor.administrative_role like '%Supervisor%'
  and supervisor.department_id is not null
on conflict (supervisor_staff_id, teacher_staff_id) do nothing;

alter table public.supervisor_staff_links enable row level security;

create policy "Staff read their own supervision links" on public.supervisor_staff_links for select to authenticated
using (
  supervisor_staff_id = (select staff_id from public.profiles where user_id = (select auth.uid()))
  or teacher_staff_id = (select staff_id from public.profiles where user_id = (select auth.uid()))
  or private.is_active_staff(array['super_admin'])
);

create policy "Super admin manages supervision links" on public.supervisor_staff_links for all to authenticated
using (private.is_active_staff(array['super_admin']))
with check (private.is_active_staff(array['super_admin']));

grant select, insert, update, delete on public.supervisor_staff_links to authenticated;

create or replace function private.is_department_supervisor_for(target_teacher_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles supervisor
    join public.supervisor_staff_links link on link.supervisor_staff_id = supervisor.staff_id
    join public.profiles teacher on teacher.staff_id = link.teacher_staff_id
    where supervisor.user_id = (select auth.uid())
      and supervisor.role = 'admin'
      and supervisor.status = 'active'
      and teacher.user_id = target_teacher_id
  );
$$;

revoke all on function private.is_department_supervisor_for(uuid) from public;
grant execute on function private.is_department_supervisor_for(uuid) to authenticated;

-- A teacher may resubmit a returned plan. The app never writes reviewed_by,
-- while the review RPC remains the only route to approve or request changes.
drop policy if exists "Teachers update their own submissions" on public.plan_submissions;
create policy "Teachers update their own submissions" on public.plan_submissions for update to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and status in ('draft', 'submitted')
);
