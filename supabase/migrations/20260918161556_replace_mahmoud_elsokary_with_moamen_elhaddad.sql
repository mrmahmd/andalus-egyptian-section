-- Replace Mahmoud El Sokary with Moamen El Haddad in the English department.
-- Mahmoud's authored plan data is removed, while shared weekly-plan shells and
-- other teachers' records are preserved. Moamen is added without an account or
-- teaching assignments so he can register later.

begin;

do $$
declare
  mahmoud_staff_id uuid;
  mahmoud_user_id uuid;
  english_department_id uuid;
begin
  select id
  into strict mahmoud_staff_id
  from public.staff_directory
  where full_name = 'محمود السكري'
    and account_kind = 'teacher';

  if exists (
    select 1
    from public.staff_directory
    where full_name = 'مؤمن الحداد'
      and account_kind = 'teacher'
  ) then
    raise exception 'Moamen El Haddad already exists in staff_directory; no changes were applied';
  end if;

  select id
  into strict english_department_id
  from public.departments
  where code = 'english';

  select user_id
  into mahmoud_user_id
  from public.profiles
  where staff_id = mahmoud_staff_id;

  if mahmoud_user_id is not null then
    if exists (
      select 1
      from public.weekly_plan_holidays
      where created_by = mahmoud_user_id
    ) then
      raise exception 'Mahmoud owns shared holiday records; no changes were applied';
    end if;

    -- Remove only plan content authored by Mahmoud. The weekly plan itself can
    -- contain other teachers' work, so it must remain in place.
    delete from public.plan_entries
    where teacher_id = mahmoud_user_id;

    delete from public.plan_quizzes
    where teacher_id = mahmoud_user_id;

    delete from public.plan_notes
    where teacher_id = mahmoud_user_id;

    delete from public.plan_submissions
    where teacher_id = mahmoud_user_id;

    -- Remove current scheduling/access links. Do not transfer any assignment
    -- to Moamen until the school confirms the new allocation.
    delete from public.teacher_assignments
    where teacher_id = mahmoud_user_id;

    update public.timetable_slots
    set teacher_id = null
    where teacher_id = mahmoud_user_id;

    delete from public.weekly_plan_teacher_access
    where teacher_id = mahmoud_user_id;
  end if;

  delete from public.registration_requests
  where staff_id = mahmoud_staff_id;

  -- Deleting the Auth user cascades to the profile. The explicit profile delete
  -- also covers an unusual staff profile whose Auth row is already missing.
  if mahmoud_user_id is not null then
    delete from auth.users
    where id = mahmoud_user_id;

    delete from public.profiles
    where user_id = mahmoud_user_id;
  end if;

  delete from public.staff_directory
  where id = mahmoud_staff_id;

  insert into public.staff_directory (
    full_name,
    account_kind,
    department_id,
    administrative_role,
    is_active
  ) values (
    'مؤمن الحداد',
    'teacher',
    english_department_id,
    null,
    true
  );
end;
$$;

commit;
