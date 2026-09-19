begin;

-- A teacher's edits remain private until the relevant subject submission is
-- approved. The class/week plan is published only when every required
-- teacher/subject pair from the timetable has an approved submission.
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
    exists (
      select 1
      from public.timetable_slots slot
      join public.subjects subject_record on subject_record.id = slot.subject_id
      join public.weekly_plans plan_record on plan_record.class_id = slot.class_id
      where plan_record.id = target_plan_id
        and slot.requires_weekly_plan_submission
        and subject_record.include_in_weekly_plan
        and not exists (
          select 1 from public.weekly_plan_holidays holiday
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
        and slot.teacher_id is null
        and not exists (
          select 1 from public.weekly_plan_holidays holiday
          where holiday.week_id = plan_record.week_id
            and holiday.day_of_week = slot.day_of_week
        )
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
          and slot.teacher_id is not null
          and not exists (
            select 1 from public.weekly_plan_holidays holiday
            where holiday.week_id = plan_record.week_id
              and holiday.day_of_week = slot.day_of_week
          )
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

create or replace function private.refresh_publication_after_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_weekly_plan_publication_state(old.weekly_plan_id);
    return old;
  end if;
  perform private.refresh_weekly_plan_publication_state(new.weekly_plan_id);
  return new;
end;
$$;

drop trigger if exists refresh_publication_after_plan_entry on public.plan_entries;
drop trigger if exists sync_weekly_plan_publication_on_submission on public.plan_submissions;
create trigger sync_weekly_plan_publication_on_submission
after insert or update or delete on public.plan_submissions
for each row execute function private.refresh_publication_after_submission();

-- Re-evaluate existing class plans under the restored approval rules.
select private.refresh_weekly_plan_publication_state(id)
from public.weekly_plans;

commit;
