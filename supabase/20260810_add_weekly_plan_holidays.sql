-- A Super Admin can replace one school day with a clear, public holiday notice.
-- Teacher content is intentionally preserved; the holiday is only a display and workflow override.

create table if not exists public.weekly_plan_holidays (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.academic_weeks(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 4),
  title text not null default 'Official Holiday',
  note text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, day_of_week)
);

alter table public.weekly_plan_holidays enable row level security;
grant select on public.weekly_plan_holidays to anon, authenticated;
grant insert, update, delete on public.weekly_plan_holidays to authenticated;

drop policy if exists "Public reads weekly plan holidays" on public.weekly_plan_holidays;
create policy "Public reads weekly plan holidays"
on public.weekly_plan_holidays for select
to anon, authenticated
using (true);

drop policy if exists "Super admins manage weekly plan holidays" on public.weekly_plan_holidays;
create policy "Super admins manage weekly plan holidays"
on public.weekly_plan_holidays for all
to authenticated
using ((select private.is_active_staff(array['super_admin'])))
with check ((select private.is_active_staff(array['super_admin'])));

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
        and subject_record.include_in_weekly_plan
        and not exists (select 1 from public.weekly_plan_holidays holiday where holiday.week_id = plan_record.week_id and holiday.day_of_week = t.day_of_week)
    )
    and not exists (
      select 1
      from public.timetable_slots t
      join public.subjects subject_record on subject_record.id = t.subject_id
      join public.weekly_plans plan_record on plan_record.class_id = t.class_id
      where plan_record.id = target_plan_id
        and subject_record.include_in_weekly_plan
        and not exists (select 1 from public.weekly_plan_holidays holiday where holiday.week_id = plan_record.week_id and holiday.day_of_week = t.day_of_week)
        and t.teacher_id is null
    )
    and not exists (
      select 1
      from (
        select distinct t.teacher_id, t.subject_id
        from public.timetable_slots t
        join public.subjects subject_record on subject_record.id = t.subject_id
        join public.weekly_plans plan_record on plan_record.class_id = t.class_id
        where plan_record.id = target_plan_id
          and subject_record.include_in_weekly_plan
          and not exists (select 1 from public.weekly_plan_holidays holiday where holiday.week_id = plan_record.week_id and holiday.day_of_week = t.day_of_week)
          and t.teacher_id is not null
      ) required_submission
      where not exists (
        select 1 from public.plan_submissions submission
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

create or replace function private.refresh_weekly_plans_after_holiday_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_week_id uuid;
begin
  affected_week_id := case when tg_op = 'DELETE' then old.week_id else new.week_id end;
  perform private.refresh_weekly_plan_publication_state(id)
  from public.weekly_plans
  where week_id = affected_week_id;
  return coalesce(new, old);
end;
$$;

revoke all on function private.refresh_weekly_plans_after_holiday_change() from public;

drop trigger if exists refresh_weekly_plans_after_holiday_change on public.weekly_plan_holidays;
create trigger refresh_weekly_plans_after_holiday_change
after insert or update or delete on public.weekly_plan_holidays
for each row execute function private.refresh_weekly_plans_after_holiday_change();
