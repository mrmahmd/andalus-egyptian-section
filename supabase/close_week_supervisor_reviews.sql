begin;

-- Use the same week switch as teacher entry. Cover both individual and bulk
-- supervisor RPCs without replacing their authorization/publication logic.
create or replace function private.enforce_supervisor_review_week()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  week_is_open boolean;
begin
  if actor_id is null or private.is_active_staff(array['super_admin']) then
    return new;
  end if;

  if new.status not in ('approved', 'changes_requested')
    or not private.is_department_supervisor_for(new.teacher_id) then
    return new;
  end if;

  if new.status is not distinct from old.status
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.review_note is not distinct from old.review_note then
    return new;
  end if;

  -- Lock the week against a simultaneous close while the review is committed.
  select week_record.teacher_entry_enabled into week_is_open
  from public.academic_weeks week_record
  join public.weekly_plans plan_record on plan_record.week_id = week_record.id
  where plan_record.id = new.weekly_plan_id
  for share of week_record;

  if coalesce(week_is_open, false) = false then
    raise exception 'This week is closed. Contact administration.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_supervisor_review_week() from public;

drop trigger if exists enforce_supervisor_review_week on public.plan_submissions;
create trigger enforce_supervisor_review_week
before update of status, reviewed_by, reviewed_at, review_note on public.plan_submissions
for each row execute function private.enforce_supervisor_review_week();

commit;
