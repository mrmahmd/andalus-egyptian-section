-- Swap the two Grade 5B lessons requested by the school owner.
-- Sunday period 6: Mohamed Farid -> Ahmed Hassan (Arabic)
-- Tuesday period 1: Ahmed Hassan -> Mohamed Farid (AL)
-- Existing weekly-plan content, including Week 4, is intentionally preserved.

do $$
declare
  target_class uuid;
  farid uuid;
  ahmed uuid;
  al_subject uuid;
  arabic_subject uuid;
  sunday_slot public.timetable_slots%rowtype;
  tuesday_slot public.timetable_slots%rowtype;
begin
  select id into target_class
  from public.school_classes
  where grade = 5 and section = 'B' and is_active = true;

  select user_id into farid
  from public.profiles
  where display_name = 'محمد فريد' and status = 'active'
  limit 1;

  select user_id into ahmed
  from public.profiles
  where display_name in ('أحمد حسن', 'احمد حسن') and status = 'active'
  order by case when display_name = 'أحمد حسن' then 0 else 1 end
  limit 1;

  select id into al_subject from public.subjects where code = 'AL';
  select id into arabic_subject from public.subjects where code = 'عربي';

  if target_class is null or farid is null or ahmed is null
     or al_subject is null or arabic_subject is null then
    raise exception 'Required Grade 5B teachers or subjects were not found';
  end if;

  select * into sunday_slot
  from public.timetable_slots
  where class_id = target_class and day_of_week = 0 and period_number = 6;

  select * into tuesday_slot
  from public.timetable_slots
  where class_id = target_class and day_of_week = 2 and period_number = 1;

  if sunday_slot.id is null or tuesday_slot.id is null then
    raise exception 'Expected Grade 5B timetable slots were not found';
  end if;

  if sunday_slot.teacher_id is distinct from farid
     or sunday_slot.subject_id is distinct from al_subject
     or tuesday_slot.teacher_id is distinct from ahmed
     or tuesday_slot.subject_id is distinct from arabic_subject then
    raise exception 'Current Grade 5B slots do not match the expected pre-swap state';
  end if;

  update public.timetable_slots
  set teacher_id = ahmed, subject_id = arabic_subject
  where id = sunday_slot.id;

  update public.timetable_slots
  set teacher_id = farid, subject_id = al_subject
  where id = tuesday_slot.id;
end;
$$;
