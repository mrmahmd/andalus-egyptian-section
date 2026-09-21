-- Independent Super Admin controls for teacher entry and parent visibility.
-- Closing teacher entry never deletes drafts or published plans. Hiding a week
-- from parents never changes its publication/approval status.

begin;

alter table public.academic_weeks
  add column if not exists teacher_entry_enabled boolean not null default true,
  add column if not exists parent_portal_visible boolean not null default true;

comment on column public.academic_weeks.teacher_entry_enabled is
  'When false, teachers cannot create, edit, copy, withdraw, or submit content for this week.';
comment on column public.academic_weeks.parent_portal_visible is
  'When false, published plans for this week are hidden from anonymous parent access.';

drop policy if exists "Super admin manages academic week visibility" on public.academic_weeks;
create policy "Super admin manages academic week visibility"
on public.academic_weeks
for update
to authenticated
using ((select private.is_active_staff(array['super_admin'])))
with check ((select private.is_active_staff(array['super_admin'])));

grant update (teacher_entry_enabled, parent_portal_visible)
on public.academic_weeks
to authenticated;

-- Parent access must obey the independent week-visibility switch even when the
-- plan itself remains approved and published.
drop policy if exists "Public reads published plans" on public.weekly_plans;
create policy "Public reads published plans"
on public.weekly_plans
for select
to anon
using (
  status = 'published'
  and exists (
    select 1
    from public.academic_weeks week_record
    where week_record.id = weekly_plans.week_id
      and week_record.parent_portal_visible
  )
);

drop policy if exists "Public reads published plan entries" on public.plan_entries;
drop policy if exists "Public reads supervisor-approved plan entries" on public.plan_entries;
create policy "Public reads published plan entries"
on public.plan_entries
for select
to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    join public.academic_weeks week_record on week_record.id = plan_record.week_id
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = plan_entries.teacher_id
     and submission.subject_id = plan_entries.subject_id
    where plan_record.id = plan_entries.weekly_plan_id
      and plan_record.status = 'published'
      and week_record.parent_portal_visible
      and submission.status = 'approved'
  )
);

drop policy if exists "Public reads published quizzes" on public.plan_quizzes;
drop policy if exists "Public reads supervisor-approved quizzes" on public.plan_quizzes;
create policy "Public reads published quizzes"
on public.plan_quizzes
for select
to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    join public.academic_weeks week_record on week_record.id = plan_record.week_id
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = plan_quizzes.teacher_id
     and submission.subject_id = plan_quizzes.subject_id
    where plan_record.id = plan_quizzes.weekly_plan_id
      and plan_record.status = 'published'
      and week_record.parent_portal_visible
      and submission.status = 'approved'
  )
);

drop policy if exists "Public reads published notes" on public.plan_notes;
drop policy if exists "Public reads supervisor-approved notes" on public.plan_notes;
create policy "Public reads published notes"
on public.plan_notes
for select
to anon
using (
  exists (
    select 1
    from public.weekly_plans plan_record
    join public.academic_weeks week_record on week_record.id = plan_record.week_id
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = plan_notes.teacher_id
    where plan_record.id = plan_notes.weekly_plan_id
      and plan_record.status = 'published'
      and week_record.parent_portal_visible
      and submission.status = 'approved'
  )
);

-- Database enforcement protects closed weeks even if an old browser tab or a
-- direct API request tries to bypass the teacher workspace filters. Supervisor
-- reviews of other teachers remain available after teacher entry is closed.
create or replace function private.enforce_teacher_entry_week()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_week_id uuid;
  target_plan_id uuid;
  actor_owns_content boolean := false;
  entry_is_open boolean := true;
begin
  if actor_id is null or private.is_active_staff(array['super_admin']) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'weekly_plans' then
    target_week_id := new.week_id;
    actor_owns_content := exists (
      select 1
      from public.timetable_slots slot
      where slot.class_id = new.class_id
        and slot.teacher_id = actor_id
        and slot.requires_weekly_plan_submission
    );
  else
    target_plan_id := coalesce(new.weekly_plan_id, old.weekly_plan_id);
    select plan_record.week_id
    into target_week_id
    from public.weekly_plans plan_record
    where plan_record.id = target_plan_id;

    actor_owns_content := coalesce(new.teacher_id, old.teacher_id) = actor_id;
  end if;

  if not actor_owns_content then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select week_record.teacher_entry_enabled
  into entry_is_open
  from public.academic_weeks week_record
  where week_record.id = target_week_id;

  if coalesce(entry_is_open, false) = false then
    raise exception 'This academic week is closed for teacher entry.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.enforce_teacher_entry_week() from public;

drop trigger if exists enforce_teacher_week_on_plan_insert on public.weekly_plans;
create trigger enforce_teacher_week_on_plan_insert
before insert on public.weekly_plans
for each row execute function private.enforce_teacher_entry_week();

drop trigger if exists enforce_teacher_week_on_entries on public.plan_entries;
create trigger enforce_teacher_week_on_entries
before insert or update or delete on public.plan_entries
for each row execute function private.enforce_teacher_entry_week();

drop trigger if exists enforce_teacher_week_on_quizzes on public.plan_quizzes;
create trigger enforce_teacher_week_on_quizzes
before insert or update or delete on public.plan_quizzes
for each row execute function private.enforce_teacher_entry_week();

drop trigger if exists enforce_teacher_week_on_notes on public.plan_notes;
create trigger enforce_teacher_week_on_notes
before insert or update or delete on public.plan_notes
for each row execute function private.enforce_teacher_entry_week();

drop trigger if exists enforce_teacher_week_on_submissions on public.plan_submissions;
create trigger enforce_teacher_week_on_submissions
before insert or update or delete on public.plan_submissions
for each row execute function private.enforce_teacher_entry_week();

commit;
