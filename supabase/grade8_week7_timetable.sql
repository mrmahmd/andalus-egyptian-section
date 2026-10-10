-- Mohamed Sayed Bakr: subject-only correction, effective from Week 7.
-- Never moves, deletes or rewrites saved plan records or timetable slot IDs.
begin;

create temporary table grade8_week7_before on commit drop as
select 'entries' as kind, md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) as fingerprint from public.plan_entries e
union all select 'submissions',md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'[]')) from public.plan_submissions s
union all select 'plans',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]')) from public.weekly_plans p;

do $$
declare
  actor uuid;
  arabic uuid;
  islamic uuid;
  required record;
  actual public.timetable_slots%rowtype;
begin
  select user_id into strict actor from public.profiles where display_name='محمد سيد بكر' and status='active';
  select id into strict arabic from public.subjects where code='arabic';
  select id into strict islamic from public.subjects where code='islamic';
  if exists (
    select 1 from public.plan_entries e
    join public.weekly_plans p on p.id=e.weekly_plan_id
    join public.academic_weeks w on w.id=p.week_id
    join public.school_classes c on c.id=p.class_id
    where c.grade=8 and c.section in ('A','B') and e.teacher_id=actor and w.week_number>=7
  ) then raise exception 'Week 7 or later already has saved lessons: inspect content before changing subjects.'; end if;
  for required in select * from (values
    ('A',0,7,'islamic','islamic'),('A',2,8,'arabic','islamic'),('A',4,3,'islamic','arabic'),
    ('B',2,7,'islamic','islamic'),('B',3,3,'islamic','arabic'),('B',4,6,'arabic','islamic')
  ) as r(section,day,period,old_code,new_code) loop
    select t.* into strict actual from public.timetable_slots t
    join public.school_classes c on c.id=t.class_id
    where c.grade=8 and c.section=required.section and c.is_active
      and t.day_of_week=required.day and t.period_number=required.period for update of t;
    if actual.teacher_id is distinct from actor or actual.subject_id not in
      (case required.old_code when 'arabic' then arabic else islamic end,
       case required.new_code when 'arabic' then arabic else islamic end)
    then raise exception 'Unexpected teacher or subject in Grade 8% day % period %',required.section,required.day,required.period; end if;
    if not exists(select 1 from public.teacher_assignments a where a.teacher_id=actor and a.class_id=actual.class_id
      and a.subject_id=case required.new_code when 'arabic' then arabic else islamic end)
    then raise exception 'The target subject is not assigned to Mohamed Bakr.'; end if;
    update public.timetable_slots set subject_id=case required.new_code when 'arabic' then arabic else islamic end
    where id=actual.id and subject_id is distinct from case required.new_code when 'arabic' then arabic else islamic end;
  end loop;
end;
$$;

-- INVOKER: this only reads the already-readable timetable, not staff content.
create or replace function private.grade_eight_subject_at_week(slot_id uuid, week_id uuid)
returns uuid language sql stable security invoker set search_path='' as $$
  select coalesce(previous.subject_id,t.subject_id)
  from public.timetable_slots t
  join public.school_classes c on c.id=t.class_id
  join public.academic_weeks w on w.id=week_id
  left join public.timetable_slots previous on previous.class_id=t.class_id
    and c.grade=8 and w.week_number<7 and (
      (c.section='A' and t.day_of_week=2 and t.period_number=8 and previous.day_of_week=4 and previous.period_number=3) or
      (c.section='A' and t.day_of_week=4 and t.period_number=3 and previous.day_of_week=2 and previous.period_number=8) or
      (c.section='B' and t.day_of_week=3 and t.period_number=3 and previous.day_of_week=4 and previous.period_number=6) or
      (c.section='B' and t.day_of_week=4 and t.period_number=6 and previous.day_of_week=3 and previous.period_number=3))
  where t.id=slot_id;
$$;
revoke all on function private.grade_eight_subject_at_week(uuid,uuid) from public;
grant execute on function private.grade_eight_subject_at_week(uuid,uuid) to authenticated;

-- Preserve the deployed copy/delegation logic and privileges. Fail rather than
-- overwrite an unfamiliar function version. Only resolve these four subjects.
do $$
declare definition text; anchor text;
begin
  select pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure) into definition;
  anchor := 'coalesce(previous_slot.subject_id,t.subject_id)';
  if strpos(definition,anchor)>0 then
    execute replace(definition,anchor,'coalesce(previous_slot.subject_id,private.grade_eight_subject_at_week(t.id,source_week_id))');
  elsif strpos(definition,'private.grade_eight_subject_at_week(t.id,source_week_id)')=0 then
    raise exception 'Unrecognized copy function: no timetable change will be committed.';
  end if;
  select pg_get_functiondef('public.super_admin_staff_action(uuid,text,jsonb)'::regprocedure) into definition;
  anchor := 'if not found then raise exception ''A lesson is outside the selected teacher assignments.'' using errcode=''42501''; end if;';
  if strpos(definition,'slot.subject_id := private.grade_eight_subject_at_week(slot.id,v_week_id);')=0 then
    if strpos(definition,anchor)=0 then raise exception 'Unrecognized delegated save function: no changes will be committed.'; end if;
    execute replace(definition,anchor,anchor || E'\n      slot.subject_id := private.grade_eight_subject_at_week(slot.id,v_week_id);');
  end if;
end;
$$;

do $$
begin
  if exists (
    select * from grade8_week7_before
    except
    (select 'entries',md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) from public.plan_entries e
    union all select 'submissions',md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'[]')) from public.plan_submissions s
    union all select 'plans',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]')) from public.weekly_plans p)
  ) then raise exception 'Saved plans changed during the correction: rolling back.'; end if;
end;
$$;
select 'Grade 8 corrected from Week 7; all saved plans, entries and approvals unchanged.' as result;
commit;
