-- Give only the active Super Admin a persistent, auditable publication override.
-- Normal supervisor approvals are preserved and resume controlling publication
-- as soon as the override is removed.

alter table public.weekly_plans
  add column if not exists manual_publication_override boolean not null default false,
  add column if not exists publication_override_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists publication_override_at timestamptz;

comment on column public.weekly_plans.manual_publication_override is
'When true, the active Super Admin has explicitly published this class plan before all normal supervisor approvals are complete.';

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
        and not exists (
          select 1 from public.weekly_plan_holidays holiday
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
            select 1 from public.weekly_plan_holidays holiday
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

create or replace function public.set_weekly_plan_publication_override(
  target_plan_id uuid,
  should_publish boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_active_staff(array['super_admin'])) then
    raise exception 'Only the active Super Admin can override weekly-plan publication';
  end if;

  if not exists (select 1 from public.weekly_plans where id = target_plan_id) then
    raise exception 'Weekly plan not found';
  end if;

  update public.weekly_plans
  set manual_publication_override = should_publish,
      publication_override_by = case when should_publish then (select auth.uid()) else null end,
      publication_override_at = case when should_publish then now() else null end,
      updated_at = now()
  where id = target_plan_id;

  perform private.refresh_weekly_plan_publication_state(target_plan_id);
  return true;
end;
$$;

revoke all on function public.set_weekly_plan_publication_override(uuid, boolean) from public;
grant execute on function public.set_weekly_plan_publication_override(uuid, boolean) to authenticated;

drop policy if exists "Public reads published plan entries" on public.plan_entries;
create policy "Public reads published plan entries" on public.plan_entries for select to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    where plan_record.id = weekly_plan_id
      and plan_record.status = 'published'
      and (
        plan_record.manual_publication_override
        or exists (
          select 1 from public.plan_submissions submission
          where submission.weekly_plan_id = plan_record.id
            and submission.teacher_id = plan_entries.teacher_id
            and submission.subject_id = plan_entries.subject_id
            and submission.status = 'approved'
        )
      )
  )
);

drop policy if exists "Public reads published quizzes" on public.plan_quizzes;
create policy "Public reads published quizzes" on public.plan_quizzes for select to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    where plan_record.id = weekly_plan_id
      and plan_record.status = 'published'
      and (
        plan_record.manual_publication_override
        or exists (
          select 1 from public.plan_submissions submission
          where submission.weekly_plan_id = plan_record.id
            and submission.teacher_id = plan_quizzes.teacher_id
            and submission.subject_id = plan_quizzes.subject_id
            and submission.status = 'approved'
        )
      )
  )
);

drop policy if exists "Public reads published notes" on public.plan_notes;
create policy "Public reads published notes" on public.plan_notes for select to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    where plan_record.id = weekly_plan_id
      and plan_record.status = 'published'
      and (
        plan_record.manual_publication_override
        or exists (
          select 1 from public.plan_submissions submission
          where submission.weekly_plan_id = plan_record.id
            and submission.teacher_id = plan_notes.teacher_id
            and submission.status = 'approved'
        )
      )
  )
);
