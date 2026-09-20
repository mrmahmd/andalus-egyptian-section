begin;

-- Repair any already-submitted teaching plans created by active supervisors.
-- The repair is deliberately limited to the supervisor's own timetable slots.
update public.plan_submissions submission
set status = 'approved',
    review_note = null,
    reviewed_by = submission.teacher_id,
    reviewed_at = coalesce(submission.reviewed_at, now()),
    submitted_at = coalesce(submission.submitted_at, now()),
    updated_at = now()
from public.profiles supervisor,
     public.staff_directory staff
where submission.teacher_id = supervisor.user_id
  and supervisor.staff_id = staff.id
  and supervisor.role = 'admin'
  and supervisor.status = 'active'
  and staff.is_active
  and staff.administrative_role like '%Supervisor%'
  and submission.status = 'submitted'
  and exists (
    select 1
    from public.weekly_plans plan
    join public.timetable_slots slot
      on slot.class_id = plan.class_id
     and slot.teacher_id = submission.teacher_id
     and slot.subject_id = submission.subject_id
     and slot.requires_weekly_plan_submission
    where plan.id = submission.weekly_plan_id
  );

-- Approve all currently submitted plans from teachers explicitly linked to the
-- signed-in supervisor, across every class and section in one selected week.
create or replace function public.approve_my_week_submissions(
  target_week_id uuid
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

  if not exists (
    select 1
    from public.profiles supervisor
    join public.staff_directory staff on staff.id = supervisor.staff_id
    where supervisor.user_id = (select auth.uid())
      and supervisor.role = 'admin'
      and supervisor.status = 'active'
      and staff.is_active
      and staff.administrative_role like '%Supervisor%'
  ) then
    raise exception 'Active supervisor access required';
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

revoke all on function public.approve_my_week_submissions(uuid) from public;
revoke all on function public.approve_my_week_submissions(uuid) from anon;
grant execute on function public.approve_my_week_submissions(uuid) to authenticated;

commit;
