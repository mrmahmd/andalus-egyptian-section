begin;

-- No saved content or workflow state is rewritten during installation.
create temporary table october_exam_before on commit drop as
select 'entries' kind, md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) fingerprint from public.plan_entries e
union all select 'submissions',md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'[]')) from public.plan_submissions s
union all select 'plans',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]')) from public.weekly_plans p;

create or replace function private.is_october_exam(target_week uuid, lesson_day integer, lesson_period integer)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(lesson_period=3 and lesson_day between 0 and 4 and
    exists(select 1 from public.academic_weeks w where w.id=target_week and w.week_number=7),false);
$$;
create or replace function private.is_october_exam_entry(target_plan uuid, lesson_day integer, lesson_period integer)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((select private.is_october_exam(p.week_id,lesson_day,lesson_period)
    from public.weekly_plans p where p.id=target_plan),false);
$$;
revoke all on function private.is_october_exam(uuid,integer,integer) from public;
revoke all on function private.is_october_exam_entry(uuid,integer,integer) from public;
grant execute on function private.is_october_exam(uuid,integer,integer), private.is_october_exam_entry(uuid,integer,integer) to authenticated;

create or replace function private.enforce_october_exam_lesson()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    if private.is_october_exam_entry(old.weekly_plan_id,old.day_of_week,old.period_number) then
      if tg_op='UPDATE' then
        if (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
      end if;
      raise exception 'October Exam: Week 7 period 3 is read only. Saved content is preserved.' using errcode='42501';
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    if private.is_october_exam_entry(new.weekly_plan_id,new.day_of_week,new.period_number) then
      raise exception 'October Exam: Week 7 period 3 is read only.' using errcode='42501';
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function private.enforce_october_exam_lesson() from public;
drop trigger if exists enforce_october_exam_lesson on public.plan_entries;
create trigger enforce_october_exam_lesson before insert or update or delete on public.plan_entries
for each row execute function private.enforce_october_exam_lesson();

-- Patch the deployed versions, retaining historical schedules, RLS, ownership,
-- manual publication overrides and delegated staff controls.
do $$
declare definition text; anchor text;
begin
  select pg_get_functiondef('public.update_my_published_plan(uuid,jsonb,text)'::regprocedure) into definition;
  if strpos(definition,'private.is_october_exam_entry')=0 then
    anchor := 'entry.teacher_id = actor_id';
    if strpos(definition,anchor)=0 then raise exception 'Unrecognized approved correction function'; end if;
    execute replace(definition,anchor,anchor || ' and not private.is_october_exam_entry(entry.weekly_plan_id,entry.day_of_week,entry.period_number)');
  end if;
  select pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure) into definition;
  if strpos(definition,'private.is_october_exam_entry')=0 then
    definition := replace(definition,'e.teacher_id=actor_id','e.teacher_id = actor_id');
    if strpos(definition,'e.teacher_id = actor_id')=0 or strpos(definition,'and t.requires_weekly_plan_submission')=0 then
      raise exception 'Unrecognized copy function';
    end if;
    definition := replace(definition,'e.teacher_id = actor_id','e.teacher_id = actor_id and not private.is_october_exam_entry(e.weekly_plan_id,e.day_of_week,e.period_number)');
    definition := replace(definition,'and t.requires_weekly_plan_submission','and t.requires_weekly_plan_submission and not private.is_october_exam(source_week_id,t.day_of_week,t.period_number)');
    execute definition;
  end if;
  select pg_get_functiondef('private.refresh_weekly_plan_without_teacher_override(uuid)'::regprocedure) into definition;
  if strpos(definition,'private.is_october_exam')=0 then
    anchor := 'and slot.requires_weekly_plan_submission';
    if strpos(definition,anchor)=0 then raise exception 'Unrecognized normal publication function'; end if;
    definition := replace(definition,anchor,anchor || ' and not private.is_october_exam(plan_record.week_id,slot.day_of_week,slot.period_number)');
    definition := replace(definition,'and entry.subject_id = approved_submission.subject_id','and entry.subject_id = approved_submission.subject_id and not private.is_october_exam_entry(entry.weekly_plan_id,entry.day_of_week,entry.period_number)');
    definition := replace(definition,'and draft_entry.subject_id = unresolved_submission.subject_id','and draft_entry.subject_id = unresolved_submission.subject_id and not private.is_october_exam_entry(draft_entry.weekly_plan_id,draft_entry.day_of_week,draft_entry.period_number)');
    execute definition;
  end if;
end;
$$;

do $$
begin
  if exists(select * from october_exam_before except
    (select 'entries',md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) from public.plan_entries e
    union all select 'submissions',md5(coalesce(jsonb_agg(to_jsonb(s) order by s.id)::text,'[]')) from public.plan_submissions s
    union all select 'plans',md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'[]')) from public.weekly_plans p))
  then raise exception 'Saved data changed; rolling back October Exam installation'; end if;
end;
$$;
select 'October Exam installed for Week 7 only; saved lessons, submissions and publication states unchanged.' as result;
commit;
