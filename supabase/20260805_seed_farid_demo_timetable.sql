with teacher as (
  select user_id from public.profiles where display_name = 'محمد فريد' and status = 'active' limit 1
), cls as (
  select id from public.school_classes where grade = 4 and section = 'A' and is_active = true limit 1
), subj as (
  select id from public.subjects where code = 'connect-plus' or lower(name_en) = 'connect plus' limit 1
)
insert into public.timetable_slots (class_id, day_of_week, period_number, subject_id, teacher_id)
select cls.id, 0, 4, subj.id, teacher.user_id
from cls cross join subj cross join teacher
where not exists (
  select 1 from public.timetable_slots t
  where t.class_id = cls.id and t.day_of_week = 0 and t.period_number = 4
);
