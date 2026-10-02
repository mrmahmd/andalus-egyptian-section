begin;

-- One RPC, one transaction. Content is read from owned rows on the server;
-- callers cannot supply another teacher's content, subject or destination slot.
create or replace function public.copy_my_weekly_plan(source_plan_id uuid, target_class_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  source_class_id uuid;
  source_week_id uuid;
  source_grade integer;
  target_grade integer;
  target_plan_id uuid;
  subject_group record;
  source_rows jsonb;
  target_slots jsonb;
  mappings jsonb := '[]'::jsonb;
  row_item jsonb;
  slot_item jsonb;
  source_count integer;
  slot_count integer;
  next_index integer;
  slot_index integer;
  last_usable integer;
  candidate integer;
  source_index integer;
  copied_count integer;
  submitted_count integer;
  total_slots integer := 0;
  copied_subjects integer;
begin
  if actor_id is null or not private.is_active_staff(array['teacher','admin']) then
    raise exception 'COPY_ACCESS_DENIED' using errcode = '42501';
  end if;
  if not coalesce(
    (select a.is_open from public.weekly_plan_teacher_access a where a.teacher_id = actor_id),
    (select a.is_open from public.weekly_plan_access_control a where a.id = 1), true
  ) then
    raise exception 'COPY_ACCESS_DENIED' using errcode = '42501';
  end if;
  select p.class_id, p.week_id, c.grade into source_class_id, source_week_id, source_grade
  from public.weekly_plans p join public.school_classes c on c.id = p.class_id
  where p.id = source_plan_id and p.status in ('draft','published');
  select c.grade into target_grade from public.school_classes c where c.id = target_class_id;
  if source_class_id is null or target_grade is null or source_class_id = target_class_id
    or not exists (select 1 from public.teacher_assignments a where a.teacher_id = actor_id and a.class_id = source_class_id)
    or not exists (select 1 from public.teacher_assignments a where a.teacher_id = actor_id and a.class_id = target_class_id) then
    raise exception 'COPY_ACCESS_DENIED' using errcode = '42501';
  end if;
  if source_grade <> target_grade then raise exception 'COPY_GRADE_MISMATCH'; end if;
  -- The existing write triggers also recheck week access during insertion.
  perform 1 from public.academic_weeks w where w.id = source_week_id and w.teacher_entry_enabled;
  if not found then raise exception 'COPY_CLOSED_WEEK' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_class_id::text || ':' || source_week_id::text));
  perform 1 from public.plan_entries e where e.weekly_plan_id = source_plan_id and e.teacher_id = actor_id for share;

  if exists (
    select 1 from public.plan_entries e where e.weekly_plan_id = source_plan_id and e.teacher_id = actor_id
      and (btrim(e.classwork) <> '' or btrim(e.homework) <> '' or btrim(e.classera_notes) <> '')
      and not exists (select 1 from public.teacher_assignments a where a.teacher_id = actor_id and a.class_id = source_class_id and a.subject_id = e.subject_id)
  ) then raise exception 'COPY_ACCESS_DENIED' using errcode = '42501'; end if;

  -- Group English programmes together, but never Discover or French. All other
  -- subjects retain their exact subject id, preventing Arabic/Religion mixing.
  for subject_group in
    select case when s.name_en = 'English' or s.name_en like 'English %'
                      or s.name_en in ('Connect Plus','Hello Plus','Hello','Upstream')
                then '__english__' else e.subject_id::text end as group_key,
           min(s.name_en) as label
    from public.plan_entries e join public.subjects s on s.id = e.subject_id
    where e.weekly_plan_id = source_plan_id and e.teacher_id = actor_id
      and (btrim(e.classwork) <> '' or btrim(e.homework) <> '' or btrim(e.classera_notes) <> '')
    group by 1 order by 1
  loop
    select jsonb_agg(to_jsonb(e) order by e.day_of_week, e.period_number, e.id) into source_rows
    from public.plan_entries e join public.subjects s on s.id = e.subject_id
    where e.weekly_plan_id = source_plan_id and e.teacher_id = actor_id
      and (btrim(e.classwork) <> '' or btrim(e.homework) <> '' or btrim(e.classera_notes) <> '')
      and (case when s.name_en = 'English' or s.name_en like 'English %'
                     or s.name_en in ('Connect Plus','Hello Plus','Hello','Upstream')
                then '__english__' else e.subject_id::text end) = subject_group.group_key;
    -- Grade 5B's Sunday/Tuesday swap starts at week 5. Keep earlier weeks
    -- aligned with the same historical timetable used by editor and parents.
    with effective_slots as (
      select t.id,t.class_id,t.day_of_week,t.period_number,t.requires_weekly_plan_submission,
             coalesce(previous_slot.subject_id,t.subject_id) as subject_id,
             case when previous_slot.id is not null then previous_slot.teacher_id else t.teacher_id end as teacher_id
      from public.timetable_slots t
      join public.school_classes c on c.id = t.class_id
      join public.academic_weeks w on w.id = source_week_id
      left join public.timetable_slots previous_slot on previous_slot.class_id = t.class_id
        and c.grade = 5 and c.section = 'B' and w.week_number < 5
        and ((t.day_of_week = 0 and t.period_number = 6 and previous_slot.day_of_week = 2 and previous_slot.period_number = 1)
          or (t.day_of_week = 2 and t.period_number = 1 and previous_slot.day_of_week = 0 and previous_slot.period_number = 6))
      where t.class_id = target_class_id
    )
    select jsonb_agg(to_jsonb(t) order by t.day_of_week, t.period_number, t.id) into target_slots
    from effective_slots t join public.subjects s on s.id = t.subject_id
    where t.class_id = target_class_id and t.teacher_id = actor_id and t.requires_weekly_plan_submission
      and exists (select 1 from public.teacher_assignments a where a.teacher_id = actor_id and a.class_id = target_class_id and a.subject_id = t.subject_id)
      and not exists (select 1 from public.weekly_plan_holidays h where h.week_id = source_week_id and h.day_of_week = t.day_of_week)
      and (case when s.name_en = 'English' or s.name_en like 'English %'
                     or s.name_en in ('Connect Plus','Hello Plus','Hello','Upstream')
                then '__english__' else t.subject_id::text end) = subject_group.group_key;
    source_count := jsonb_array_length(source_rows);
    slot_count := coalesce(jsonb_array_length(target_slots), 0);
    if slot_count = 0 then
      raise exception 'COPY_SUBJECT_UNAVAILABLE' using detail = subject_group.label;
    end if;
    if source_count > slot_count then
      raise exception 'COPY_INSUFFICIENT_SLOTS' using detail = subject_group.label || ': ' || source_count || ' / ' || slot_count;
    end if;
    total_slots := total_slots + slot_count;
    next_index := 0;
    for source_index in 0..source_count - 1 loop
      row_item := source_rows -> source_index;
      slot_index := next_index;
      last_usable := slot_count - (source_count - source_index);
      if subject_group.group_key = '__english__' then
        -- Preserve weekly order and leave enough slots for every remaining row.
        -- Prefer the same day, then a later day; otherwise use the next slot.
        select i into candidate from generate_series(next_index, last_usable) i
        where (target_slots -> i ->> 'day_of_week')::integer = (row_item ->> 'day_of_week')::integer
        order by i limit 1;
        if candidate is null then
          select i into candidate from generate_series(next_index, last_usable) i
          where (target_slots -> i ->> 'day_of_week')::integer > (row_item ->> 'day_of_week')::integer
          order by i limit 1;
        end if;
        slot_index := coalesce(candidate, next_index);
      end if;
      slot_item := target_slots -> slot_index;
      mappings := mappings || jsonb_build_array(jsonb_build_object('entry',row_item,'slot',slot_item));
      next_index := slot_index + 1;
    end loop;
  end loop;
  if jsonb_array_length(mappings) = 0 then raise exception 'COPY_EMPTY_SOURCE'; end if;

  select p.id into target_plan_id from public.weekly_plans p
  where p.class_id = target_class_id and p.week_id = source_week_id;
  if target_plan_id is not null then
    perform 1 from public.plan_entries e where e.weekly_plan_id = target_plan_id and e.teacher_id = actor_id for update;
    perform 1 from public.plan_submissions s where s.weekly_plan_id = target_plan_id and s.teacher_id = actor_id for update;
    if exists (select 1 from public.plan_entries e where e.weekly_plan_id = target_plan_id and e.teacher_id = actor_id
                 and (btrim(e.classwork) <> '' or btrim(e.homework) <> '' or btrim(e.classera_notes) <> ''))
      or exists (select 1 from public.plan_submissions s where s.weekly_plan_id = target_plan_id and s.teacher_id = actor_id and s.status <> 'draft') then
      return jsonb_build_object('status','conflict','target_plan_id',target_plan_id);
    end if;
  else
    insert into public.weekly_plans (class_id,week_id,status)
    values (target_class_id,source_week_id,'draft') on conflict (class_id,week_id) do nothing
    returning id into target_plan_id;
    if target_plan_id is null then
      select p.id into target_plan_id from public.weekly_plans p where p.class_id = target_class_id and p.week_id = source_week_id;
      -- A competing shell creation must be retried rather than skipping checks.
      raise exception 'COPY_TARGET_OCCUPIED';
    end if;
  end if;

  -- Delete only this teacher's empty rows for copied subjects. Other subjects,
  -- other teachers, announcements, quizzes, notes and publication flags survive.
  delete from public.plan_entries e where e.weekly_plan_id = target_plan_id and e.teacher_id = actor_id
    and btrim(e.classwork) = '' and btrim(e.homework) = '' and btrim(e.classera_notes) = ''
    and e.subject_id in (select (m -> 'slot' ->> 'subject_id')::uuid from jsonb_array_elements(mappings) m);
  insert into public.plan_entries (weekly_plan_id,timetable_slot_id,teacher_id,subject_id,day_of_week,period_number,classwork,homework,classera_notes)
  select target_plan_id,(m -> 'slot' ->> 'id')::uuid,actor_id,(m -> 'slot' ->> 'subject_id')::uuid,
         (m -> 'slot' ->> 'day_of_week')::smallint,(m -> 'slot' ->> 'period_number')::smallint,
         coalesce(m -> 'entry' ->> 'classwork',''),coalesce(m -> 'entry' ->> 'homework',''),coalesce(m -> 'entry' ->> 'classera_notes','')
  from jsonb_array_elements(mappings) m;
  get diagnostics copied_count = row_count;
  if copied_count <> jsonb_array_length(mappings) then raise exception 'COPY_TARGET_OCCUPIED'; end if;
  select count(distinct m -> 'slot' ->> 'subject_id') into copied_subjects from jsonb_array_elements(mappings) m;
  insert into public.plan_submissions (weekly_plan_id,teacher_id,subject_id,status,submitted_at,reviewed_by,reviewed_at,review_note)
  select distinct target_plan_id,actor_id,(m -> 'slot' ->> 'subject_id')::uuid,'draft',null::timestamptz,null::uuid,null::timestamptz,null::text
  from jsonb_array_elements(mappings) m
  on conflict (weekly_plan_id,teacher_id,subject_id) do update
    set status = 'draft',submitted_at = null,reviewed_by = null,reviewed_at = null,review_note = null,updated_at = now()
    where plan_submissions.status = 'draft';
  get diagnostics submitted_count = row_count;
  if submitted_count <> copied_subjects then raise exception 'COPY_TARGET_OCCUPIED'; end if;
  return jsonb_build_object('status','copied','target_plan_id',target_plan_id,'copied_lessons',copied_count,'copied_subjects',copied_subjects,'empty_slots',total_slots - copied_count);
end;
$$;
revoke all on function public.copy_my_weekly_plan(uuid,uuid) from public, anon;
grant execute on function public.copy_my_weekly_plan(uuid,uuid) to authenticated;

commit;
