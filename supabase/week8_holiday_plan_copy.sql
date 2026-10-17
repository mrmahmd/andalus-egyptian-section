begin isolation level repeatable read;

-- Compare a stable snapshot inside this installation transaction. The installer
-- must leave all existing plans, lessons and review decisions byte-for-byte intact.
do $before_install$
begin
  perform set_config('week8_copy.saved_rows', md5(jsonb_build_object(
    'plans',(select jsonb_agg(to_jsonb(p) order by p.id) from public.weekly_plans p),
    'entries',(select jsonb_agg(to_jsonb(e) order by e.id) from public.plan_entries e),
    'submissions',(select jsonb_agg(to_jsonb(s) order by s.id) from public.plan_submissions s)
  )::text),true);
  perform set_config('week8_copy.normal_rpc',md5(pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure)),true);
end;
$before_install$;

-- Installation only defines an opt-in RPC. It never copies or rewrites a plan.
-- The original copy_my_weekly_plan(uuid,uuid) remains unchanged for every week.
create or replace function private.join_week8_copy_field(rows_to_join jsonb, field_name text)
returns text language plpgsql immutable security invoker set search_path = '' as $$
declare row_value jsonb; value text; result text := ''; ordinal integer := 0;
begin
  for row_value in select item.value from jsonb_array_elements(rows_to_join) as item(value) loop
    ordinal := ordinal + 1;
    value := coalesce(row_value ->> field_name, '');
    if btrim(value) = '' then continue; end if;
    if result <> '' then
      result := result || E'\n\n[Source lesson ' || ordinal || ' - Period ' || (row_value ->> 'period_number') || E']\n';
    end if;
    result := result || value;
  end loop;
  return result;
end;
$$;
revoke all on function private.join_week8_copy_field(jsonb,text) from public, anon;
grant execute on function private.join_week8_copy_field(jsonb,text) to authenticated;

create or replace function public.copy_week8_plan_with_merge(
  source_plan_id uuid, target_class_id uuid, confirmation_token text default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  source_class_id uuid; source_week_id uuid; source_grade integer; target_grade integer;
  week_number integer; week_open boolean; target_plan_id uuid;
  subject_group record; day_index integer; source_index integer; slot_index integer;
  source_rows jsonb; target_slots jsonb; day_rows jsonb; day_slots jsonb; grouped_rows jsonb;
  mapping jsonb; mappings jsonb := '[]'::jsonb; row_item jsonb; slot_item jsonb;
  source_count integer; slot_count integer; day_source_count integer; day_slot_count integer;
  total_sources integer := 0; total_slots integer := 0; merged_slots integer := 0;
  next_index integer; candidate integer; last_usable integer; copied_count integer; subject_count integer;
  target_rows jsonb; target_submissions jsonb; preview_token text; programme_count integer;
begin
  if actor_id is null or not private.is_active_staff(array['teacher','admin']) then
    raise exception 'COPY_ACCESS_DENIED' using errcode = '42501';
  end if;
  if not coalesce(
    (select a.is_open from public.weekly_plan_teacher_access a where a.teacher_id = actor_id),
    (select a.is_open from public.weekly_plan_access_control a where a.id = 1), true
  ) then raise exception 'COPY_ACCESS_DENIED' using errcode = '42501'; end if;

  select p.class_id,p.week_id,c.grade,w.week_number,w.teacher_entry_enabled
    into source_class_id,source_week_id,source_grade,week_number,week_open
  from public.weekly_plans p join public.school_classes c on c.id=p.class_id
  join public.academic_weeks w on w.id=p.week_id
  where p.id=source_plan_id and p.status in ('draft','published');
  select c.grade into target_grade from public.school_classes c where c.id=target_class_id;
  if source_class_id is null or target_grade is null or source_class_id=target_class_id
    or not exists(select 1 from public.teacher_assignments a where a.teacher_id=actor_id and a.class_id=source_class_id)
    or not exists(select 1 from public.teacher_assignments a where a.teacher_id=actor_id and a.class_id=target_class_id)
  then raise exception 'COPY_ACCESS_DENIED' using errcode='42501'; end if;
  if source_grade<>target_grade then raise exception 'COPY_GRADE_MISMATCH'; end if;
  if week_number<>8 or not exists(select 1 from public.weekly_plan_holidays h where h.week_id=source_week_id)
  then raise exception 'COPY_WEEK8_HOLIDAY_ONLY'; end if;
  if not week_open then raise exception 'COPY_CLOSED_WEEK' using errcode='42501'; end if;

  perform pg_advisory_xact_lock(hashtext(target_class_id::text || ':' || source_week_id::text));
  perform 1 from public.plan_entries e where e.weekly_plan_id=source_plan_id and e.teacher_id=actor_id for share;
  if exists(select 1 from public.plan_entries e where e.weekly_plan_id=source_plan_id and e.teacher_id=actor_id
    and (btrim(coalesce(e.classwork,''))<>'' or btrim(coalesce(e.homework,''))<>'' or btrim(coalesce(e.classera_notes,''))<>'')
    and not exists(select 1 from public.teacher_assignments a where a.teacher_id=actor_id and a.class_id=source_class_id and a.subject_id=e.subject_id))
  then raise exception 'COPY_ACCESS_DENIED' using errcode='42501'; end if;
  -- Old writing on a newly declared holiday is not silently discarded.
  if exists(select 1 from public.plan_entries e join public.weekly_plan_holidays h on h.week_id=source_week_id and h.day_of_week=e.day_of_week
    where e.weekly_plan_id=source_plan_id and e.teacher_id=actor_id
    and (btrim(coalesce(e.classwork,''))<>'' or btrim(coalesce(e.homework,''))<>'' or btrim(coalesce(e.classera_notes,''))<>''))
  then raise exception 'COPY_SOURCE_HOLIDAY_CONTENT'; end if;

  for subject_group in
    select e.subject_id,min(s.name_en) label from public.plan_entries e join public.subjects s on s.id=e.subject_id
    where e.weekly_plan_id=source_plan_id and e.teacher_id=actor_id
      and (btrim(coalesce(e.classwork,''))<>'' or btrim(coalesce(e.homework,''))<>'' or btrim(coalesce(e.classera_notes,''))<>'')
    group by e.subject_id order by e.subject_id
  loop
    select jsonb_agg(to_jsonb(e) order by e.day_of_week,e.period_number,e.id) into source_rows
    from public.plan_entries e where e.weekly_plan_id=source_plan_id and e.teacher_id=actor_id and e.subject_id=subject_group.subject_id
      and (btrim(coalesce(e.classwork,''))<>'' or btrim(coalesce(e.homework,''))<>'' or btrim(coalesce(e.classera_notes,''))<>'');
    select jsonb_agg(to_jsonb(t) order by t.day_of_week,t.period_number,t.id) into target_slots
    from public.timetable_slots t where t.class_id=target_class_id and t.teacher_id=actor_id
      and t.subject_id=subject_group.subject_id and t.requires_weekly_plan_submission
      and exists(select 1 from public.teacher_assignments a where a.teacher_id=actor_id and a.class_id=target_class_id and a.subject_id=t.subject_id)
      and not exists(select 1 from public.weekly_plan_holidays h where h.week_id=source_week_id and h.day_of_week=t.day_of_week);
    source_count:=jsonb_array_length(source_rows); slot_count:=coalesce(jsonb_array_length(target_slots),0);
    if slot_count=0 then raise exception 'COPY_SUBJECT_UNAVAILABLE' using detail=subject_group.label; end if;
    total_sources:=total_sources+source_count; total_slots:=total_slots+slot_count;

    if source_count>slot_count then
      -- Merge only within the same exact subject AND school day. Never move or
      -- drop surplus writing on a day without a destination lesson.
      for day_index in 0..4 loop
        select coalesce(jsonb_agg(value order by ordinality),'[]') into day_rows
        from jsonb_array_elements(source_rows) with ordinality where (value->>'day_of_week')::integer=day_index;
        select coalesce(jsonb_agg(value order by ordinality),'[]') into day_slots
        from jsonb_array_elements(target_slots) with ordinality where (value->>'day_of_week')::integer=day_index;
        day_source_count:=jsonb_array_length(day_rows); day_slot_count:=jsonb_array_length(day_slots);
        if day_source_count=0 then continue; end if;
        if day_slot_count=0 then raise exception 'COPY_MERGE_DAY_UNAVAILABLE' using detail=subject_group.label || ': day ' || day_index; end if;
        for slot_index in 0..least(day_source_count,day_slot_count)-1 loop
          select jsonb_agg(value order by ordinality) into grouped_rows
          from jsonb_array_elements(day_rows) with ordinality
          where (case when day_source_count>day_slot_count then ((ordinality-1)*day_slot_count/day_source_count)::integer else ordinality-1 end)=slot_index;
          if jsonb_array_length(grouped_rows)>1 and (subject_group.label='English' or subject_group.label like 'English %') then
            select count(distinct coalesce(substring(value->>'classwork' from '^(AL|OL)[[:space:]]*[-—]'),'unspecified')) into programme_count
            from jsonb_array_elements(grouped_rows) where btrim(coalesce(value->>'classwork',''))<>'';
            if programme_count>1 then raise exception 'COPY_MERGE_PROGRAMME_MISMATCH' using detail=subject_group.label; end if;
          end if;
          if jsonb_array_length(grouped_rows)>1 then merged_slots:=merged_slots+1; end if;
          mappings:=mappings || jsonb_build_array(jsonb_build_object('subject',subject_group.label,'slot',day_slots->slot_index,'sources',grouped_rows));
        end loop;
      end loop;
    else
      -- Ordinary subjects keep their chronological copy behavior. English also
      -- retains the same-day preference without skipping needed later slots.
      next_index:=0;
      for source_index in 0..source_count-1 loop
        row_item:=source_rows->source_index; slot_index:=next_index;
        if subject_group.label='English' or subject_group.label like 'English %' then
          last_usable:=slot_count-(source_count-source_index);
          select i into candidate from generate_series(next_index,last_usable) i
          where (target_slots->i->>'day_of_week')::integer=(row_item->>'day_of_week')::integer order by i limit 1;
          if candidate is null then
            select i into candidate from generate_series(next_index,last_usable) i
            where (target_slots->i->>'day_of_week')::integer>(row_item->>'day_of_week')::integer order by i limit 1;
          end if;
          slot_index:=coalesce(candidate,next_index);
        end if;
        mappings:=mappings || jsonb_build_array(jsonb_build_object('subject',subject_group.label,'slot',target_slots->slot_index,'sources',jsonb_build_array(row_item)));
        next_index:=slot_index+1;
      end loop;
    end if;
  end loop;
  if jsonb_array_length(mappings)=0 then raise exception 'COPY_EMPTY_SOURCE'; end if;
  select sum(jsonb_array_length(item->'sources')) into copied_count from jsonb_array_elements(mappings) item;
  if copied_count<>total_sources then raise exception 'COPY_MAPPING_INCOMPLETE'; end if;
  if merged_slots=0 then return jsonb_build_object('status','normal_copy_available'); end if;

  -- Compose each field independently; notes/homework never become Classwork.
  select jsonb_agg(m || jsonb_build_object(
    'classwork',private.join_week8_copy_field(m->'sources','classwork'),
    'homework',private.join_week8_copy_field(m->'sources','homework'),
    'classera_notes',private.join_week8_copy_field(m->'sources','classera_notes')) order by ordinality)
    into mappings from jsonb_array_elements(mappings) with ordinality as item(m,ordinality);
  select p.id into target_plan_id from public.weekly_plans p where p.class_id=target_class_id and p.week_id=source_week_id;
  perform 1 from public.plan_entries e where e.weekly_plan_id=target_plan_id and e.teacher_id=actor_id for update;
  perform 1 from public.plan_submissions s where s.weekly_plan_id=target_plan_id and s.teacher_id=actor_id for update;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') into target_rows
    from public.plan_entries e where e.weekly_plan_id=target_plan_id and e.teacher_id=actor_id;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') into target_submissions
    from public.plan_submissions s where s.weekly_plan_id=target_plan_id and s.teacher_id=actor_id;
  if exists(select 1 from public.plan_entries e where e.weekly_plan_id=target_plan_id and e.teacher_id=actor_id
    and (btrim(coalesce(e.classwork,''))<>'' or btrim(coalesce(e.homework,''))<>'' or btrim(coalesce(e.classera_notes,''))<>''))
    or exists(select 1 from public.plan_submissions s where s.weekly_plan_id=target_plan_id and s.teacher_id=actor_id and s.status<>'draft')
  then return jsonb_build_object('status','conflict','target_plan_id',target_plan_id); end if;
  preview_token:=md5(jsonb_build_object('actor',actor_id,'source',source_plan_id,'target',target_class_id,'week',source_week_id,'mappings',mappings,'target_plan',target_plan_id,'rows',target_rows,'submissions',target_submissions)::text);
  if confirmation_token is null then
    return jsonb_build_object('status','preview','token',preview_token,'source_lessons',total_sources,'target_lessons',jsonb_array_length(mappings),'merged_slots',merged_slots,'mappings',mappings);
  end if;
  if confirmation_token is distinct from preview_token then raise exception 'COPY_PREVIEW_STALE'; end if;

  if target_plan_id is null then
    insert into public.weekly_plans(class_id,week_id,status) values(target_class_id,source_week_id,'draft')
      on conflict(class_id,week_id) do nothing returning id into target_plan_id;
    if target_plan_id is null then raise exception 'COPY_TARGET_OCCUPIED'; end if;
  end if;
  delete from public.plan_entries e where e.weekly_plan_id=target_plan_id and e.teacher_id=actor_id
    and btrim(coalesce(e.classwork,''))='' and btrim(coalesce(e.homework,''))='' and btrim(coalesce(e.classera_notes,''))=''
    and e.subject_id in(select (m->'slot'->>'subject_id')::uuid from jsonb_array_elements(mappings) m);
  insert into public.plan_entries(weekly_plan_id,timetable_slot_id,teacher_id,subject_id,day_of_week,period_number,classwork,homework,classera_notes)
    select target_plan_id,(m->'slot'->>'id')::uuid,actor_id,(m->'slot'->>'subject_id')::uuid,
      (m->'slot'->>'day_of_week')::smallint,(m->'slot'->>'period_number')::smallint,m->>'classwork',m->>'homework',m->>'classera_notes'
    from jsonb_array_elements(mappings) m;
  get diagnostics copied_count=row_count;
  if copied_count<>jsonb_array_length(mappings) then raise exception 'COPY_TARGET_OCCUPIED'; end if;
  select count(distinct m->'slot'->>'subject_id') into subject_count from jsonb_array_elements(mappings) m;
  insert into public.plan_submissions(weekly_plan_id,teacher_id,subject_id,status,submitted_at,reviewed_by,reviewed_at,review_note)
    select distinct target_plan_id,actor_id,(m->'slot'->>'subject_id')::uuid,'draft',null::timestamptz,null::uuid,null::timestamptz,null::text
    from jsonb_array_elements(mappings) m
    on conflict(weekly_plan_id,teacher_id,subject_id) do update set status='draft',submitted_at=null,reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now()
      where plan_submissions.status='draft';
  get diagnostics copied_count=row_count;
  if copied_count<>subject_count then raise exception 'COPY_TARGET_OCCUPIED'; end if;
  return jsonb_build_object('status','copied','target_plan_id',target_plan_id,'copied_lessons',jsonb_array_length(mappings),'source_lessons',total_sources,'merged_slots',merged_slots,'empty_slots',total_slots-jsonb_array_length(mappings));
end;
$$;
revoke all on function public.copy_week8_plan_with_merge(uuid,uuid,text) from public, anon;
grant execute on function public.copy_week8_plan_with_merge(uuid,uuid,text) to authenticated;

-- Extend the existing audited workspace without replacing its other actions.
-- Preview content and the confirmation token must not enter the audit log.
do $install_delegation$
declare definition text; original text;
begin
  if to_regprocedure('public.super_admin_staff_action(uuid,text,jsonb)') is null then return; end if;
  select pg_get_functiondef('public.super_admin_staff_action(uuid,text,jsonb)'::regprocedure) into definition;
  if position('when ''copy_week8_plan_with_merge'' then' in definition)>0 then return; end if;
  original:=definition;
  definition:=replace(definition,'''copy_my_weekly_plan'',''review_plan_submission''',
    '''copy_my_weekly_plan'',''copy_week8_plan_with_merge'',''review_plan_submission''');
  if definition=original then raise exception 'Unrecognized staff workspace allowlist; installation rolled back'; end if;
  original:=definition;
  definition:=replace(definition,'when ''copy_my_weekly_plan'' then', $new_case$
    when 'copy_week8_plan_with_merge' then
      result := public.copy_week8_plan_with_merge((payload->>'source_plan_id')::uuid,(payload->>'target_class_id')::uuid,payload->>'confirmation_token');
      context := jsonb_build_object('source_plan_id',payload->>'source_plan_id','target_class_id',payload->>'target_class_id','status',result->>'status','copied_lessons',result->'copied_lessons');
    when 'copy_my_weekly_plan' then$new_case$);
  if definition=original then raise exception 'Unrecognized staff workspace copy action; installation rolled back'; end if;
  execute definition;
end;
$install_delegation$;

do $verify_install$
begin
  if current_setting('week8_copy.saved_rows') is distinct from md5(jsonb_build_object(
    'plans',(select jsonb_agg(to_jsonb(p) order by p.id) from public.weekly_plans p),
    'entries',(select jsonb_agg(to_jsonb(e) order by e.id) from public.plan_entries e),
    'submissions',(select jsonb_agg(to_jsonb(s) order by s.id) from public.plan_submissions s)
  )::text) then raise exception 'Installation changed existing plan data; rolled back'; end if;
  if current_setting('week8_copy.normal_rpc') is distinct from md5(pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure))
  then raise exception 'Installation changed normal copy; rolled back'; end if;
end;
$verify_install$;

commit;
