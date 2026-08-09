-- Department supervisors publish the subjects they approve.
-- Super Admin can still manage public plans, but no longer gates publication.

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

  -- Publication is decided only after every timetable-linked subject for the
  -- class/week has an approved submission. The current production helper is
  -- installed by 20260809_require_all_supervisor_approvals.sql.
  perform private.refresh_weekly_plan_publication_state(submission.weekly_plan_id);

  return submission;
end;
$$;

revoke all on function public.review_plan_submission(uuid, text, text) from public;
grant execute on function public.review_plan_submission(uuid, text, text) to authenticated;

-- A class plan can contain several subjects. Families can see only entries,
-- quizzes, and notes belonging to a subject approved by its supervisor.
drop policy if exists "Public reads published plan entries" on public.plan_entries;
create policy "Public reads supervisor-approved plan entries" on public.plan_entries for select to anon
using (
  exists (
    select 1
    from public.weekly_plans p
    join public.plan_submissions s
      on s.weekly_plan_id = p.id
     and s.teacher_id = plan_entries.teacher_id
     and s.subject_id = plan_entries.subject_id
    where p.id = weekly_plan_id and p.status = 'published' and s.status = 'approved'
  )
);

drop policy if exists "Public reads published quizzes" on public.plan_quizzes;
create policy "Public reads supervisor-approved quizzes" on public.plan_quizzes for select to anon
using (
  exists (
    select 1
    from public.weekly_plans p
    join public.plan_submissions s
      on s.weekly_plan_id = p.id
     and s.teacher_id = plan_quizzes.teacher_id
     and s.subject_id = plan_quizzes.subject_id
    where p.id = weekly_plan_id and p.status = 'published' and s.status = 'approved'
  )
);

drop policy if exists "Public reads published notes" on public.plan_notes;
create policy "Public reads supervisor-approved notes" on public.plan_notes for select to anon
using (
  exists (
    select 1
    from public.weekly_plans p
    join public.plan_submissions s
      on s.weekly_plan_id = p.id
     and s.teacher_id = plan_notes.teacher_id
    where p.id = weekly_plan_id and p.status = 'published' and s.status = 'approved'
  )
);
