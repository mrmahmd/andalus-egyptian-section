-- Add the Monday slot used by the first supervisor-review demonstration.
-- Monday is day_of_week = 1; the public family table will still hide the period number.
insert into public.timetable_slots (class_id, day_of_week, period_number, subject_id, teacher_id)
select cls.id, 1, 1, subj.id, teacher.user_id
from public.school_classes cls
cross join lateral (
  select id from public.subjects
  where code in ('connect_plus', 'connect-plus') or lower(name_en) = 'connect plus'
  order by case when code = 'connect_plus' then 0 else 1 end
  limit 1
) subj
cross join lateral (
  select user_id from public.profiles
  where display_name = 'محمد فريد' and status = 'active'
  limit 1
) teacher
where cls.grade = 4 and cls.section = 'A' and cls.is_active = true
  and not exists (
    select 1 from public.timetable_slots existing
    where existing.class_id = cls.id
      and existing.day_of_week = 1
      and existing.period_number = 1
  );
