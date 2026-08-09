-- A family plan is public only when every teacher/subject that appears in the
-- class timetable has been approved by its responsible department supervisor.
-- Quran, PE and Swimming are excluded because they have no teacher plan.

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
      from public.timetable_slots t
      join public.subjects subject_record on subject_record.id = t.subject_id
      join public.weekly_plans plan_record on plan_record.class_id = t.class_id
      where plan_record.id = target_plan_id
        and t.teacher_id is not null
        and subject_record.include_in_weekly_plan
    )
    and not exists (
      select 1
      from (
        select distinct t.teacher_id, t.subject_id
        from public.timetable_slots t
        join public.subjects subject_record on subject_record.id = t.subject_id
        join public.weekly_plans plan_record on plan_record.class_id = t.class_id
        where plan_record.id = target_plan_id
          and t.teacher_id is not null
          and subject_record.include_in_weekly_plan
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

create or replace function private.sync_weekly_plan_publication_state()
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

revoke all on function private.sync_weekly_plan_publication_state() from public;

drop trigger if exists sync_weekly_plan_publication_on_submission on public.plan_submissions;
create trigger sync_weekly_plan_publication_on_submission
after insert or update or delete on public.plan_submissions
for each row execute function private.sync_weekly_plan_publication_state();

-- Recalculate existing test plans immediately so a previously published plan
-- with a pending teacher submission becomes private again.
select private.refresh_weekly_plan_publication_state(id)
from public.weekly_plans;
