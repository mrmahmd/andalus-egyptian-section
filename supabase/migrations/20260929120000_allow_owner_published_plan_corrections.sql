begin;

-- A closed week still blocks drafts, new entries, withdrawals and submissions.
-- Only the owner may correct existing, approved entries of a published plan.
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
      select 1 from public.timetable_slots slot
      where slot.class_id = new.class_id
        and slot.teacher_id = actor_id
        and slot.requires_weekly_plan_submission
    );
  else
    target_plan_id := case when tg_op = 'DELETE' then old.weekly_plan_id else new.weekly_plan_id end;
    select plan_record.week_id into target_week_id
    from public.weekly_plans plan_record where plan_record.id = target_plan_id;
    actor_owns_content := (case when tg_op = 'DELETE' then old.teacher_id else new.teacher_id end) = actor_id;
  end if;

  if not actor_owns_content then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select week_record.teacher_entry_enabled into entry_is_open
  from public.academic_weeks week_record where week_record.id = target_week_id;
  if coalesce(entry_is_open, false) = false then
    if not coalesce(
      (select access_record.is_open from public.weekly_plan_teacher_access access_record where access_record.teacher_id = actor_id),
      (select access_record.is_open from public.weekly_plan_access_control access_record where access_record.id = 1),
      true
    ) then
      raise exception 'Weekly plan access is closed for this teacher.' using errcode = '42501';
    end if;
    if tg_table_name = 'plan_entries' and tg_op = 'UPDATE'
      and old.weekly_plan_id = new.weekly_plan_id
      and old.timetable_slot_id is not distinct from new.timetable_slot_id
      and old.teacher_id = new.teacher_id
      and old.subject_id = new.subject_id
      and old.day_of_week = new.day_of_week
      and old.period_number = new.period_number
      and exists (
        select 1 from public.weekly_plans plan_record
        join public.plan_submissions submission
          on submission.weekly_plan_id = plan_record.id
         and submission.teacher_id = actor_id
         and submission.subject_id = old.subject_id
         and submission.status = 'approved'
        where plan_record.id = old.weekly_plan_id
          and plan_record.status = 'published'
      ) then
      return new;
    end if;

    if tg_table_name = 'plan_notes'
      and (case when tg_op = 'UPDATE'
        then old.weekly_plan_id = new.weekly_plan_id and old.teacher_id = new.teacher_id
        else true end)
      and exists (
        select 1 from public.weekly_plans plan_record
        join public.plan_submissions submission
          on submission.weekly_plan_id = plan_record.id
         and submission.teacher_id = actor_id
         and submission.status = 'approved'
        where plan_record.id = target_plan_id
          and plan_record.status = 'published'
      ) then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;

    raise exception 'This academic week is closed for teacher entry.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.enforce_teacher_entry_week() from public;

-- Invoker rights keep table RLS in force. The entire correction succeeds or
-- rolls back together; no draft or supervisor status is written here.
create or replace function public.update_my_published_plan(
  target_plan_id uuid,
  lesson_changes jsonb,
  dictation_note text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_class_id uuid;
  expected_count integer;
  changed_count integer;
begin
  if actor_id is null or not private.is_active_staff(array['teacher','admin']) then
    raise exception 'An active teacher account is required.' using errcode = '42501';
  end if;
  if not coalesce(
    (select access_record.is_open from public.weekly_plan_teacher_access access_record where access_record.teacher_id = actor_id),
    (select access_record.is_open from public.weekly_plan_access_control access_record where access_record.id = 1),
    true
  ) then
    raise exception 'Weekly plan access is closed for this teacher.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_plan_id::text));

  select plan_record.class_id into target_class_id
  from public.weekly_plans plan_record
  where plan_record.id = target_plan_id and plan_record.status = 'published';
  if target_class_id is null then
    raise exception 'This class plan is not published.' using errcode = '42501';
  end if;

  select count(*) into expected_count
  from public.plan_entries entry
  join public.plan_submissions submission
    on submission.weekly_plan_id = entry.weekly_plan_id
   and submission.teacher_id = entry.teacher_id
   and submission.subject_id = entry.subject_id
   and submission.status = 'approved'
  where entry.weekly_plan_id = target_plan_id
    and entry.teacher_id = actor_id;

  if expected_count = 0 or jsonb_typeof(lesson_changes) <> 'array'
     or jsonb_array_length(lesson_changes) <> expected_count
     or (select count(distinct (item->>'slot_id')) from jsonb_array_elements(lesson_changes) item) <> expected_count
     or exists (
       select 1 from jsonb_array_elements(lesson_changes) item
       where item->>'slot_id' is null
          or item->>'classwork' is null
          or item->>'homework' is null
          or item->>'classera_notes' is null
          or length(item->>'classwork') > 12000
          or length(item->>'homework') > 12000
          or length(item->>'classera_notes') > 12000
     ) then
    raise exception 'The published lesson list is incomplete or invalid.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(lesson_changes)
      as change_record(slot_id uuid, classwork text, homework text, classera_notes text)
    left join public.plan_entries entry
      on entry.weekly_plan_id = target_plan_id
     and entry.timetable_slot_id = change_record.slot_id
     and entry.teacher_id = actor_id
    where entry.id is null
       or not exists (
         select 1 from public.plan_submissions submission
         where submission.weekly_plan_id = target_plan_id
           and submission.teacher_id = actor_id
           and submission.subject_id = entry.subject_id
           and submission.status = 'approved'
       )
  ) then
    raise exception 'A lesson is not owned, approved, or saved in this plan.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from jsonb_to_recordset(lesson_changes)
      as change_record(slot_id uuid, classwork text, homework text, classera_notes text)
    where btrim(change_record.classwork) <> ''
       or btrim(change_record.homework) <> ''
       or btrim(change_record.classera_notes) <> ''
  ) then
    raise exception 'A published teaching plan must retain at least one written lesson.' using errcode = '22023';
  end if;

  update public.plan_entries entry
  set classwork = change_record.classwork,
      homework = change_record.homework,
      classera_notes = change_record.classera_notes,
      updated_at = now()
  from jsonb_to_recordset(lesson_changes)
    as change_record(slot_id uuid, classwork text, homework text, classera_notes text)
  where entry.weekly_plan_id = target_plan_id
    and entry.timetable_slot_id = change_record.slot_id
    and entry.teacher_id = actor_id;
  get diagnostics changed_count = row_count;
  if changed_count <> expected_count then
    raise exception 'Not every lesson update was saved.' using errcode = 'P0001';
  end if;

  if dictation_note is not null then
    if not exists (
      select 1 from public.profiles profile
      join public.departments department on department.id = profile.department_id
      where profile.user_id = actor_id and department.name_en = 'English Department'
    ) then
      raise exception 'Only English teachers can change dictation words.' using errcode = '42501';
    end if;
    if length(dictation_note) > 8000 then
      raise exception 'The dictation words are too long.' using errcode = '22023';
    end if;
    delete from public.plan_notes
    where weekly_plan_id = target_plan_id and teacher_id = actor_id;
    if btrim(dictation_note) <> '' then
      insert into public.plan_notes (weekly_plan_id, teacher_id, note_text)
      values (target_plan_id, actor_id, dictation_note);
    end if;
  end if;

  if not exists (
    select 1 from public.weekly_plans plan_record
    where plan_record.id = target_plan_id and plan_record.status = 'published'
  ) then
    raise exception 'The class plan is no longer published; changes were rolled back.' using errcode = 'P0001';
  end if;

  return changed_count;
end;
$$;

revoke all on function public.update_my_published_plan(uuid, jsonb, text)
from public, anon, authenticated;
grant execute on function public.update_my_published_plan(uuid, jsonb, text)
to authenticated;

commit;
