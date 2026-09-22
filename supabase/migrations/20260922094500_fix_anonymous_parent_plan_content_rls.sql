-- Let anonymous parent views evaluate approval state without granting direct
-- SELECT access to the staff-facing plan_submissions table.

begin;

create or replace function private.parent_can_read_approved_plan_content(
  target_plan_id uuid,
  target_teacher_id uuid,
  target_subject_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.weekly_plans plan_record
    join public.academic_weeks week_record
      on week_record.id = plan_record.week_id
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = target_teacher_id
     and (target_subject_id is null or submission.subject_id = target_subject_id)
    where plan_record.id = target_plan_id
      and plan_record.status = 'published'
      and week_record.parent_portal_visible
      and submission.status = 'approved'
  );
$$;

revoke all on function private.parent_can_read_approved_plan_content(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function private.parent_can_read_approved_plan_content(uuid, uuid, uuid)
to anon;

drop policy if exists "Public reads published plan entries" on public.plan_entries;
drop policy if exists "Public reads supervisor-approved plan entries" on public.plan_entries;
create policy "Public reads published plan entries"
on public.plan_entries
for select
to anon
using (
  (select private.parent_can_read_approved_plan_content(
    plan_entries.weekly_plan_id,
    plan_entries.teacher_id,
    plan_entries.subject_id
  ))
);

drop policy if exists "Public reads published quizzes" on public.plan_quizzes;
drop policy if exists "Public reads supervisor-approved quizzes" on public.plan_quizzes;
create policy "Public reads published quizzes"
on public.plan_quizzes
for select
to anon
using (
  (select private.parent_can_read_approved_plan_content(
    plan_quizzes.weekly_plan_id,
    plan_quizzes.teacher_id,
    plan_quizzes.subject_id
  ))
);

drop policy if exists "Public reads published notes" on public.plan_notes;
drop policy if exists "Public reads supervisor-approved notes" on public.plan_notes;
create policy "Public reads published notes"
on public.plan_notes
for select
to anon
using (
  (select private.parent_can_read_approved_plan_content(
    plan_notes.weekly_plan_id,
    plan_notes.teacher_id,
    null
  ))
);

commit;
