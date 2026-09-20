begin;

-- Publish a class/week once at least one required teacher plan is approved and
-- every plan that entered the review workflow has been resolved. A teacher who
-- has not started, or who has only a private draft, no longer blocks the class.
-- Submitted or changes-requested work still blocks publication until approved.
create or replace function private.refresh_weekly_plan_publication_state(target_plan_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_is_ready boolean := false;
  has_manual_override boolean := false;
begin
  select coalesce(plan_record.manual_publication_override, false)
  into has_manual_override
  from public.weekly_plans plan_record
  where plan_record.id = target_plan_id;

  if has_manual_override then
    update public.weekly_plans
    set status = 'published',
        published_by = coalesce(publication_override_by, published_by),
        published_at = coalesce(published_at, publication_override_at, now()),
        updated_at = now()
    where id = target_plan_id;
    return true;
  end if;

  select
    -- Never publish an empty or completely unstarted class plan.
    exists (
      select 1
      from public.plan_submissions approved_submission
      join public.weekly_plans plan_record
        on plan_record.id = approved_submission.weekly_plan_id
      where approved_submission.weekly_plan_id = target_plan_id
        and approved_submission.status = 'approved'
        and exists (
          select 1
          from public.timetable_slots slot
          join public.subjects subject_record on subject_record.id = slot.subject_id
          where slot.class_id = plan_record.class_id
            and slot.teacher_id = approved_submission.teacher_id
            and slot.subject_id = approved_submission.subject_id
            and slot.requires_weekly_plan_submission
            and subject_record.include_in_weekly_plan
            and not exists (
              select 1
              from public.weekly_plan_holidays holiday
              where holiday.week_id = plan_record.week_id
                and holiday.day_of_week = slot.day_of_week
            )
        )
        and exists (
          select 1
          from public.plan_entries entry
          where entry.weekly_plan_id = approved_submission.weekly_plan_id
            and entry.teacher_id = approved_submission.teacher_id
            and entry.subject_id = approved_submission.subject_id
        )
    )
    and not exists (
      -- Only unresolved work that was actually sent into review blocks release.
      select 1
      from public.plan_submissions unresolved_submission
      join public.weekly_plans plan_record
        on plan_record.id = unresolved_submission.weekly_plan_id
      where unresolved_submission.weekly_plan_id = target_plan_id
        and unresolved_submission.status in ('submitted', 'changes_requested')
        and exists (
          select 1
          from public.timetable_slots slot
          join public.subjects subject_record on subject_record.id = slot.subject_id
          where slot.class_id = plan_record.class_id
            and slot.teacher_id = unresolved_submission.teacher_id
            and slot.subject_id = unresolved_submission.subject_id
            and slot.requires_weekly_plan_submission
            and subject_record.include_in_weekly_plan
            and not exists (
              select 1
              from public.weekly_plan_holidays holiday
              where holiday.week_id = plan_record.week_id
                and holiday.day_of_week = slot.day_of_week
            )
        )
    )
  into plan_is_ready;

  update public.weekly_plans
  set status = case when plan_is_ready then 'published' else 'draft' end,
      published_by = case when plan_is_ready then coalesce(published_by, (select auth.uid())) else null end,
      published_at = case when plan_is_ready then coalesce(published_at, now()) else null end,
      updated_at = now()
  where id = target_plan_id;

  return coalesce(plan_is_ready, false);
end;
$$;

revoke all on function private.refresh_weekly_plan_publication_state(uuid) from public;

-- A partially published class must never expose another teacher's private
-- draft. Anonymous readers can see only entries whose teacher/subject
-- submission is approved for the published class plan.
drop policy if exists "Public reads published plan entries" on public.plan_entries;
drop policy if exists "Public reads supervisor-approved plan entries" on public.plan_entries;
create policy "Public reads supervisor-approved plan entries"
on public.plan_entries for select to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = plan_entries.teacher_id
     and submission.subject_id = plan_entries.subject_id
    where plan_record.id = weekly_plan_id
      and plan_record.status = 'published'
      and submission.status = 'approved'
  )
);

drop policy if exists "Public reads published quizzes" on public.plan_quizzes;
drop policy if exists "Public reads supervisor-approved quizzes" on public.plan_quizzes;
create policy "Public reads supervisor-approved quizzes"
on public.plan_quizzes for select to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = plan_quizzes.teacher_id
     and submission.subject_id = plan_quizzes.subject_id
    where plan_record.id = weekly_plan_id
      and plan_record.status = 'published'
      and submission.status = 'approved'
  )
);

drop policy if exists "Public reads published notes" on public.plan_notes;
drop policy if exists "Public reads supervisor-approved notes" on public.plan_notes;
create policy "Public reads supervisor-approved notes"
on public.plan_notes for select to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = plan_notes.teacher_id
    where plan_record.id = weekly_plan_id
      and plan_record.status = 'published'
      and submission.status = 'approved'
  )
);

-- Re-evaluate every existing class/week under the new partial-publication rule.
select private.refresh_weekly_plan_publication_state(id)
from public.weekly_plans;

commit;
