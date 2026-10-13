begin;
create temporary table october_grade_before on commit drop as
select 'entries' kind,md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) fingerprint from public.plan_entries e
union all select 'submissions',md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'[]')) from public.plan_submissions s
union all select 'plans',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]')) from public.weekly_plans p;

-- INVOKER: only reads class/week information already available to staff.
create or replace function private.is_october_exam_for_class(target_week uuid, lesson_day integer, lesson_period integer, target_class uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select private.is_october_exam(target_week,lesson_day,lesson_period)
    and exists(select 1 from public.school_classes c where c.id=target_class and c.grade>=3);
$$;
revoke all on function private.is_october_exam_for_class(uuid,integer,integer,uuid) from public;
grant execute on function private.is_october_exam_for_class(uuid,integer,integer,uuid) to authenticated;

-- Existing trigger/correction RPC keep their ownership and approved-state rules.
create or replace function private.is_october_exam_entry(target_plan uuid, lesson_day integer, lesson_period integer)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((select private.is_october_exam_for_class(p.week_id,lesson_day,lesson_period,p.class_id)
    from public.weekly_plans p where p.id=target_plan),false);
$$;

do $$
declare definition text; anchor text;
begin
  select pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure) into definition;
  anchor := 'private.is_october_exam(source_week_id,t.day_of_week,t.period_number)';
  if strpos(definition,anchor)>0 then
    execute replace(definition,anchor,'private.is_october_exam_for_class(source_week_id,t.day_of_week,t.period_number,target_class_id)');
  elsif strpos(definition,'private.is_october_exam_for_class(source_week_id,t.day_of_week,t.period_number,target_class_id)')=0 then
    raise exception 'Unrecognized copy exam protection; no changes committed';
  end if;
  select pg_get_functiondef('private.refresh_weekly_plan_without_teacher_override(uuid)'::regprocedure) into definition;
  anchor := 'private.is_october_exam(plan_record.week_id,slot.day_of_week,slot.period_number)';
  if strpos(definition,anchor)>0 then
    execute replace(definition,anchor,'private.is_october_exam_for_class(plan_record.week_id,slot.day_of_week,slot.period_number,plan_record.class_id)');
  elsif strpos(definition,'private.is_october_exam_for_class(plan_record.week_id,slot.day_of_week,slot.period_number,plan_record.class_id)')=0 then
    raise exception 'Unrecognized publication exam protection; no changes committed';
  end if;
end;
$$;
do $$
begin
  if exists(select * from october_grade_before except
    (select 'entries',md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) from public.plan_entries e
    union all select 'submissions',md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'[]')) from public.plan_submissions s
    union all select 'plans',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]')) from public.weekly_plans p))
  then raise exception 'Saved data changed; grade scope installation rolled back'; end if;
end;
$$;
select 'Week 7 period 3: Grades 1 and 2 writable, Grade 3 onward October Exam; all saved records unchanged.' as result;
commit;
