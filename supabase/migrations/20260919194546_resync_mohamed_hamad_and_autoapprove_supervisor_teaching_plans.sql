begin;

-- Re-apply Mohamed Hamad's complete verified timetable from the supplied
-- teacher schedule. Thursday Islamic Studies is period 6 (not period 5).
create temporary table expected_mohamed_hamad_slots (
  class_code text not null,
  subject_name_ar text not null,
  day_of_week smallint not null,
  period_number smallint not null
) on commit drop;

insert into expected_mohamed_hamad_slots (class_code, subject_name_ar, day_of_week, period_number) values
  ('4/B', 'اللغة العربية', 0, 8),
  ('4/B', 'التربية الإسلامية', 0, 6),
  ('4/A', 'اللغة العربية', 0, 5),
  ('4/A', 'اللغة العربية', 0, 1),
  ('4/B', 'اللغة العربية', 1, 8),
  ('4/A', 'اللغة العربية', 1, 7),
  ('4/A', 'اللغة العربية', 1, 3),
  ('4/B', 'اللغة العربية', 1, 1),
  ('4/B', 'اللغة العربية', 2, 6),
  ('4/A', 'اللغة العربية', 2, 5),
  ('4/B', 'اللغة العربية', 2, 3),
  ('4/A', 'اللغة العربية', 2, 1),
  ('4/B', 'التربية الإسلامية', 3, 8),
  ('4/A', 'اللغة العربية', 3, 4),
  ('4/A', 'التربية الإسلامية', 3, 3),
  ('4/B', 'اللغة العربية', 3, 1),
  ('4/B', 'اللغة العربية', 4, 7),
  ('4/A', 'التربية الإسلامية', 4, 6),
  ('4/B', 'اللغة العربية', 4, 3),
  ('4/A', 'اللغة العربية', 4, 1);

-- Abort before changing anything if a verified position is currently owned by
-- another teacher. This prevents a timetable correction from silently
-- overwriting somebody else's live lesson.
do $$
begin
  if exists (
    select 1
    from expected_mohamed_hamad_slots expected
    join public.school_classes school_class
      on concat(school_class.grade, '/', school_class.section) = expected.class_code
    join public.timetable_slots slot
      on slot.class_id = school_class.id
     and slot.day_of_week = expected.day_of_week
     and slot.period_number = expected.period_number
    join public.profiles mohamed_hamad
      on mohamed_hamad.username = 'm.mhamad' and mohamed_hamad.status = 'active'
    where slot.teacher_id is distinct from mohamed_hamad.user_id
  ) then
    raise exception 'Mohamed Hamad timetable resync stopped: an expected lesson position belongs to another teacher';
  end if;
end;
$$;

delete from public.timetable_slots slot
using public.profiles teacher
where teacher.user_id = slot.teacher_id
  and teacher.username = 'm.mhamad'
  and not exists (
    select 1
    from expected_mohamed_hamad_slots expected
    join public.school_classes school_class
      on concat(school_class.grade, '/', school_class.section) = expected.class_code
    join public.subjects subject_record
      on subject_record.name_ar = expected.subject_name_ar
    where school_class.id = slot.class_id
      and subject_record.id = slot.subject_id
      and expected.day_of_week = slot.day_of_week
      and expected.period_number = slot.period_number
  );

insert into public.timetable_slots (
  class_id,
  subject_id,
  teacher_id,
  day_of_week,
  period_number,
  requires_weekly_plan_submission
)
select
  school_class.id,
  subject_record.id,
  teacher.user_id,
  expected.day_of_week,
  expected.period_number,
  true
from expected_mohamed_hamad_slots expected
join public.school_classes school_class
  on concat(school_class.grade, '/', school_class.section) = expected.class_code
join public.subjects subject_record
  on subject_record.name_ar = expected.subject_name_ar
join public.profiles teacher
  on teacher.username = 'm.mhamad' and teacher.status = 'active'
on conflict (class_id, day_of_week, period_number) do update
set subject_id = excluded.subject_id,
    teacher_id = excluded.teacher_id,
    requires_weekly_plan_submission = true
where timetable_slots.teacher_id = excluded.teacher_id;

insert into public.teacher_assignments (teacher_id, class_id, subject_id)
select distinct teacher.user_id, school_class.id, subject_record.id
from expected_mohamed_hamad_slots expected
join public.school_classes school_class
  on concat(school_class.grade, '/', school_class.section) = expected.class_code
join public.subjects subject_record
  on subject_record.name_ar = expected.subject_name_ar
join public.profiles teacher
  on teacher.username = 'm.mhamad' and teacher.status = 'active'
on conflict (teacher_id, class_id, subject_id) do nothing;

-- Supervisors who also teach approve only their own submitted teaching rows.
-- These narrowly scoped permissive policies complement the normal teacher
-- policies, which intentionally allow only draft/submitted states.
drop policy if exists "Supervisors create their own approved teaching submissions" on public.plan_submissions;
create policy "Supervisors create their own approved teaching submissions"
on public.plan_submissions for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and status = 'approved'
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
  and submitted_at is not null
  and exists (
    select 1
    from public.profiles supervisor
    join public.staff_directory staff on staff.id = supervisor.staff_id
    where supervisor.user_id = (select auth.uid())
      and supervisor.role = 'admin'
      and supervisor.status = 'active'
      and staff.is_active
      and staff.administrative_role like '%Supervisor%'
  )
  and exists (
    select 1
    from public.weekly_plans plan
    join public.timetable_slots slot
      on slot.class_id = plan.class_id
     and slot.teacher_id = (select auth.uid())
     and slot.subject_id = plan_submissions.subject_id
     and slot.requires_weekly_plan_submission
    where plan.id = plan_submissions.weekly_plan_id
  )
);

drop policy if exists "Supervisors update their own approved teaching submissions" on public.plan_submissions;
create policy "Supervisors update their own approved teaching submissions"
on public.plan_submissions for update to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles supervisor
    join public.staff_directory staff on staff.id = supervisor.staff_id
    where supervisor.user_id = (select auth.uid())
      and supervisor.role = 'admin'
      and supervisor.status = 'active'
      and staff.is_active
      and staff.administrative_role like '%Supervisor%'
  )
)
with check (
  teacher_id = (select auth.uid())
  and status = 'approved'
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
  and submitted_at is not null
  and exists (
    select 1
    from public.profiles supervisor
    join public.staff_directory staff on staff.id = supervisor.staff_id
    where supervisor.user_id = (select auth.uid())
      and supervisor.role = 'admin'
      and supervisor.status = 'active'
      and staff.is_active
      and staff.administrative_role like '%Supervisor%'
  )
  and exists (
    select 1
    from public.weekly_plans plan
    join public.timetable_slots slot
      on slot.class_id = plan.class_id
     and slot.teacher_id = (select auth.uid())
     and slot.subject_id = plan_submissions.subject_id
     and slot.requires_weekly_plan_submission
    where plan.id = plan_submissions.weekly_plan_id
  )
);

commit;
