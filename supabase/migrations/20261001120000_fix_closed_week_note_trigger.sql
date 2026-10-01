begin;

-- The same trigger function guards lesson rows and note rows. Keep their
-- record-specific fields in separate branches: a plan_notes OLD record has no
-- timetable_slot_id, even when the plan is approved and the week is closed.
create or replace function private.enforce_teacher_entry_week()
returns trigger language plpgsql security definer set search_path = '' as $$
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
      where slot.class_id = new.class_id and slot.teacher_id = actor_id
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

    if tg_table_name = 'plan_entries' then
      if tg_op = 'UPDATE'
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
            and plan_record.status in ('draft', 'published')
        ) then
        return new;
      end if;
    elsif tg_table_name = 'plan_notes' then
      if (case when tg_op = 'UPDATE'
          then old.weekly_plan_id = new.weekly_plan_id and old.teacher_id = new.teacher_id
          else true end)
        and exists (
          select 1 from public.weekly_plans plan_record
          join public.plan_submissions submission
            on submission.weekly_plan_id = plan_record.id
           and submission.teacher_id = actor_id
           and submission.status = 'approved'
          where plan_record.id = target_plan_id
            and plan_record.status in ('draft', 'published')
        ) then
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end if;
    end if;

    raise exception 'This academic week is closed for teacher entry.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.enforce_teacher_entry_week() from public;

commit;
