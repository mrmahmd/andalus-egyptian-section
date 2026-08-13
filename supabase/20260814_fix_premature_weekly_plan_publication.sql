-- A subject supervisor approves only the submitted teacher/subject rows.
-- The family plan becomes public only when the central readiness check confirms
-- that every required teacher/subject pair for the class and week is approved.

create or replace function public.review_plan_submission(
  submission_id uuid,
  decision text,
  note text default null
)
returns public.plan_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission public.plan_submissions%rowtype;
begin
  if decision not in ('approved', 'changes_requested') then
    raise exception 'Invalid review decision';
  end if;

  select * into submission
  from public.plan_submissions
  where id = submission_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  if not (
    (select private.is_department_supervisor_for(submission.teacher_id))
    or (select private.is_active_staff(array['super_admin']))
  ) then
    raise exception 'Not authorized to review this submission';
  end if;

  if decision = 'changes_requested' and coalesce(btrim(note), '') = '' then
    raise exception 'A review note is required when requesting changes';
  end if;

  update public.plan_submissions
  set status = decision,
      review_note = nullif(btrim(note), ''),
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where id = submission_id
  returning * into submission;

  -- Never publish directly from one supervisor decision. The readiness function
  -- checks every required timetable teacher/subject pair before publishing.
  perform private.refresh_weekly_plan_publication_state(submission.weekly_plan_id);

  return submission;
end;
$$;

revoke all on function public.review_plan_submission(uuid, text, text) from public;
grant execute on function public.review_plan_submission(uuid, text, text) to authenticated;

-- Withdraw only the explicitly approved trial target. Approved subject
-- submissions are preserved and need no re-approval.
select private.refresh_weekly_plan_publication_state(plan_record.id)
from public.weekly_plans plan_record
join public.school_classes class_record on class_record.id = plan_record.class_id
join public.academic_weeks week_record on week_record.id = plan_record.week_id
where class_record.grade = 4
  and class_record.section = 'B'
  and week_record.week_number = 1;
