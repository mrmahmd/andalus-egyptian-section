-- Prepare the temporary timetable for a complete end-to-end platform trial.
-- The exclusions below are explicit and reversible. New timetable slots remain
-- required by default, so an accidental missing teacher still blocks publishing.

alter table public.timetable_slots
add column if not exists requires_weekly_plan_submission boolean not null default true;

comment on column public.timetable_slots.requires_weekly_plan_submission is
'When true, this timetable slot must have an assigned teacher and an approved subject submission before the class plan can be published.';

-- The current 24 unassigned English-department lessons belonged to the teacher
-- excluded from the trial. Keep them in the timetable, but do not make them gate
-- trial publication.
update public.timetable_slots slot
set requires_weekly_plan_submission = false
from public.subjects subject_record
where subject_record.id = slot.subject_id
  and subject_record.include_in_weekly_plan
  and slot.teacher_id is null;

-- Department supervisors do not teach during the current trial. Their temporary
-- timetable lessons remain visible in the trial timetable but require no plan.
with trial_supervisors as (
  select profile.user_id
  from public.profiles profile
  join public.staff_directory staff on staff.id = profile.staff_id
  where profile.role = 'admin'
    and profile.status = 'active'
    and staff.administrative_role in (
      'English Supervisor',
      'Arabic Supervisor',
      'Math & Science Supervisor'
    )
)
update public.timetable_slots slot
set requires_weekly_plan_submission = false
where slot.teacher_id in (select user_id from trial_supervisors);

-- ICT teachers report to the English supervisor during the trial.
insert into public.supervisor_staff_links (supervisor_staff_id, teacher_staff_id)
select supervisor.staff_id, teacher.staff_id
from public.profiles supervisor
cross join public.profiles teacher
join public.staff_directory teacher_directory on teacher_directory.id = teacher.staff_id
where supervisor.username = 'mhelmy'
  and supervisor.role = 'admin'
  and supervisor.status = 'active'
  and teacher.username in ('msamir', 'madkour')
  and teacher.role = 'teacher'
  and teacher.status = 'active'
on conflict (supervisor_staff_id, teacher_staff_id) do nothing;

-- A class plan is published only after every explicitly required timetable slot
-- has a teacher and every required teacher/subject pair is approved. Holidays are
-- excluded from the requirement.
create or replace function private.refresh_weekly_plan_publication_state(target_plan_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_is_ready boolean := false;
begin
  select
    exists (
      select 1
      from public.timetable_slots slot
      join public.subjects subject_record on subject_record.id = slot.subject_id
      join public.weekly_plans plan_record on plan_record.class_id = slot.class_id
      where plan_record.id = target_plan_id
        and slot.requires_weekly_plan_submission
        and subject_record.include_in_weekly_plan
        and not exists (
          select 1
          from public.weekly_plan_holidays holiday
          where holiday.week_id = plan_record.week_id
            and holiday.day_of_week = slot.day_of_week
        )
    )
    and not exists (
      select 1
      from public.timetable_slots slot
      join public.subjects subject_record on subject_record.id = slot.subject_id
      join public.weekly_plans plan_record on plan_record.class_id = slot.class_id
      where plan_record.id = target_plan_id
        and slot.requires_weekly_plan_submission
        and subject_record.include_in_weekly_plan
        and not exists (
          select 1
          from public.weekly_plan_holidays holiday
          where holiday.week_id = plan_record.week_id
            and holiday.day_of_week = slot.day_of_week
        )
        and slot.teacher_id is null
    )
    and not exists (
      select 1
      from (
        select distinct slot.teacher_id, slot.subject_id
        from public.timetable_slots slot
        join public.subjects subject_record on subject_record.id = slot.subject_id
        join public.weekly_plans plan_record on plan_record.class_id = slot.class_id
        where plan_record.id = target_plan_id
          and slot.requires_weekly_plan_submission
          and subject_record.include_in_weekly_plan
          and not exists (
            select 1
            from public.weekly_plan_holidays holiday
            where holiday.week_id = plan_record.week_id
              and holiday.day_of_week = slot.day_of_week
          )
          and slot.teacher_id is not null
      ) required_submission
      where not exists (
        select 1
        from public.plan_submissions submission
        where submission.weekly_plan_id = target_plan_id
          and submission.teacher_id = required_submission.teacher_id
          and submission.subject_id = required_submission.subject_id
          and submission.status = 'approved'
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

select private.refresh_weekly_plan_publication_state(id)
from public.weekly_plans;
