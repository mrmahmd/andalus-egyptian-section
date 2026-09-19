begin;

-- Reassign the requested teachers to exactly one agreed supervisor.
-- Usernames are stable identifiers; display names are not used for matching.
do $$
declare
  missing_accounts text;
begin
  with requested(teacher_username, supervisor_username) as (
    values
      ('msamir', 'mhelmy'),
      ('madkour', 'mhelmy'),
      ('aabuzaid1973', 'mohasay012345')
  )
  select string_agg(requested.teacher_username || ' -> ' || requested.supervisor_username, ', ')
  into missing_accounts
  from requested
  left join public.profiles teacher
    on teacher.username = requested.teacher_username
   and teacher.role = 'teacher'
   and teacher.status = 'active'
   and teacher.staff_id is not null
  left join public.profiles supervisor
    on supervisor.username = requested.supervisor_username
   and supervisor.role = 'admin'
   and supervisor.status = 'active'
   and supervisor.staff_id is not null
  where teacher.user_id is null or supervisor.user_id is null;

  if missing_accounts is not null then
    raise exception 'Missing active teacher or supervisor accounts: %', missing_accounts;
  end if;
end $$;

with requested(teacher_username, supervisor_username) as (
  values
    ('msamir', 'mhelmy'),
    ('madkour', 'mhelmy'),
    ('aabuzaid1973', 'mohasay012345')
), resolved as (
  select teacher.staff_id as teacher_staff_id, supervisor.staff_id as supervisor_staff_id
  from requested
  join public.profiles teacher on teacher.username = requested.teacher_username
  join public.profiles supervisor on supervisor.username = requested.supervisor_username
)
delete from public.supervisor_staff_links link
using resolved
where link.teacher_staff_id = resolved.teacher_staff_id
  and link.supervisor_staff_id <> resolved.supervisor_staff_id;

insert into public.supervisor_staff_links (supervisor_staff_id, teacher_staff_id, assigned_by)
select supervisor.staff_id, teacher.staff_id, (select auth.uid())
from (values
  ('msamir', 'mhelmy'),
  ('madkour', 'mhelmy'),
  ('aabuzaid1973', 'mohasay012345')
) as requested(teacher_username, supervisor_username)
join public.profiles teacher on teacher.username = requested.teacher_username
join public.profiles supervisor on supervisor.username = requested.supervisor_username
on conflict (supervisor_staff_id, teacher_staff_id) do update
set assigned_by = excluded.assigned_by;

-- Approve every currently submitted subject plan in one selected class/week,
-- but only when the teacher is explicitly linked to the signed-in supervisor.
create or replace function public.approve_my_class_week_submissions(
  target_week_id uuid,
  target_class_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  approved_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.plan_submissions submission
  set status = 'approved',
      review_note = null,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  from public.weekly_plans plan,
       public.profiles teacher,
       public.supervisor_staff_links link,
       public.profiles supervisor
  where plan.id = submission.weekly_plan_id
    and plan.week_id = target_week_id
    and plan.class_id = target_class_id
    and submission.status = 'submitted'
    and teacher.user_id = submission.teacher_id
    and teacher.role = 'teacher'
    and teacher.status = 'active'
    and link.teacher_staff_id = teacher.staff_id
    and supervisor.user_id = (select auth.uid())
    and supervisor.role = 'admin'
    and supervisor.status = 'active'
    and supervisor.staff_id = link.supervisor_staff_id;

  get diagnostics approved_count = row_count;
  return approved_count;
end;
$$;

revoke all on function public.approve_my_class_week_submissions(uuid, uuid) from public;
revoke all on function public.approve_my_class_week_submissions(uuid, uuid) from anon;
grant execute on function public.approve_my_class_week_submissions(uuid, uuid) to authenticated;

commit;
