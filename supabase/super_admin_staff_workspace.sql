-- Additive installation only: no existing plan rows, policies or functions are replaced.
begin;

create table public.staff_workspace_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(user_id),
  target_user_id uuid not null references public.profiles(user_id),
  operation text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.staff_workspace_audit enable row level security;
create policy "Super admin reads workspace audit" on public.staff_workspace_audit
for select to authenticated using (private.is_active_staff(array['super_admin']));
create policy "Super admin appends own workspace audit" on public.staff_workspace_audit
for insert to authenticated with check (actor_id = auth.uid() and private.is_active_staff(array['super_admin']));
revoke all on public.staff_workspace_audit from anon, authenticated;
grant select, insert on public.staff_workspace_audit to authenticated;
create index staff_workspace_audit_created_idx on public.staff_workspace_audit(created_at desc);

-- SECURITY INVOKER deliberately preserves RLS. A verified active Super Admin may
-- execute ONLY these enumerated actions in the target's transaction-local context.
-- No token is minted, no login/session is changed, no arbitrary SQL is accepted.
create function public.super_admin_staff_action(target_user_id uuid, operation text, payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  original_claims text := current_setting('request.jwt.claims', true);
  original_sub text := current_setting('request.jwt.claim.sub', true);
  staff_name text;
  supervisor boolean;
  result jsonb := 'null';
  plan_id uuid;
  v_class_id uuid;
  v_week_id uuid;
  slot record;
  lesson jsonb;
  subject_ids uuid[] := '{}';
  v_subject_id uuid;
  submission_status text;
  submitted boolean;
  affected integer;
  context jsonb := '{}';
begin
  if actor is null or not private.is_active_staff(array['super_admin']) then
    raise exception 'Only an active Super Admin may enter a staff workspace.' using errcode = '42501';
  end if;
  select p.display_name, (p.role = 'admin' and coalesce(s.administrative_role, '') like '%Supervisor%')
    into staff_name, supervisor
  from public.profiles p join public.staff_directory s on s.id = p.staff_id
  where p.user_id = target_user_id and p.status = 'active' and s.is_active
    and (p.role = 'teacher' or (p.role = 'admin' and s.administrative_role like '%Supervisor%'));
  if not found then raise exception 'Choose an active teacher or supervisor.' using errcode = '42501'; end if;
  if operation not in ('open_workspace','get_my_department_teachers','get_my_supervisor_review_queue',
    'save_staff_plan','update_my_published_plan','copy_my_weekly_plan','review_plan_submission',
    'approve_my_week_submissions','withdraw_staff_plan','remove_staff_dictation') then
    raise exception 'This delegated action is not permitted.' using errcode = '42501';
  end if;
  if octet_length(payload::text) > 1000000 then raise exception 'Request is too large.'; end if;
  if operation in ('get_my_department_teachers','get_my_supervisor_review_queue','review_plan_submission','approve_my_week_submissions') and not supervisor then
    raise exception 'A supervisor workspace is required.' using errcode = '42501';
  end if;

  -- Both settings are restored on success. The exception block rolls back all
  -- writes, including the audit, and restores settings before propagating failure.
  perform set_config('request.jwt.claims', (coalesce(nullif(original_claims,''),'{}')::jsonb || jsonb_build_object('sub',target_user_id))::text, true);
  perform set_config('request.jwt.claim.sub', target_user_id::text, true);

  case operation
  when 'open_workspace' then result := jsonb_build_object('user_id',target_user_id,'display_name',staff_name);
  when 'get_my_department_teachers' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]') into result from public.get_my_department_teachers() r;
  when 'get_my_supervisor_review_queue' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]') into result from public.get_my_supervisor_review_queue() r;
  when 'review_plan_submission' then
    perform public.review_plan_submission((payload->>'submission_id')::uuid, payload->>'decision', payload->>'note');
    context := jsonb_build_object('submission_id',payload->>'submission_id','decision',payload->>'decision');
  when 'approve_my_week_submissions' then
    result := to_jsonb(public.approve_my_week_submissions((payload->>'target_week_id')::uuid));
    context := jsonb_build_object('week_id',payload->>'target_week_id','approved_count',result);
  when 'copy_my_weekly_plan' then
    result := public.copy_my_weekly_plan((payload->>'source_plan_id')::uuid,(payload->>'target_class_id')::uuid);
    context := jsonb_build_object('source_plan_id',payload->>'source_plan_id','target_class_id',payload->>'target_class_id','result',result);
  when 'update_my_published_plan' then
    result := to_jsonb(public.update_my_published_plan((payload->>'target_plan_id')::uuid,payload->'lesson_changes',payload->>'dictation_note'));
    context := jsonb_build_object('plan_id',payload->>'target_plan_id','lesson_count',result);
  when 'withdraw_staff_plan' then
    plan_id := (payload->>'plan_id')::uuid;
    update public.plan_submissions set status='draft',submitted_at=null,review_note=null,reviewed_by=null,reviewed_at=null,updated_at=now()
      where weekly_plan_id=plan_id and teacher_id=target_user_id and status='submitted';
    get diagnostics affected = row_count;
    if affected=0 then raise exception 'No submitted plan was withdrawn.'; end if;
    result := to_jsonb(affected); context := jsonb_build_object('plan_id',plan_id);
  when 'remove_staff_dictation' then
    plan_id := (payload->>'plan_id')::uuid;
    if not exists (select 1 from public.plan_submissions where weekly_plan_id=plan_id and teacher_id=target_user_id and status='approved')
       or exists (select 1 from public.plan_submissions where weekly_plan_id=plan_id and teacher_id=target_user_id and status<>'approved') then
      raise exception 'Approved subjects are required.' using errcode='42501';
    end if;
    delete from public.plan_notes where weekly_plan_id=plan_id and teacher_id=target_user_id and starts_with(note_text,'__ENGLISH_DICTATION__');
    get diagnostics affected = row_count;
    result := to_jsonb(affected); context := jsonb_build_object('plan_id',plan_id);
  when 'save_staff_plan' then
    v_class_id := (payload->>'class_id')::uuid; v_week_id := (payload->>'week_id')::uuid;
    submitted := coalesce((payload->>'submit')::boolean,false);
    if not exists (select 1 from public.academic_weeks w where w.id=v_week_id and w.teacher_entry_enabled)
      or not coalesce((select a.is_open from public.weekly_plan_teacher_access a where a.teacher_id=target_user_id),
        (select a.is_open from public.weekly_plan_access_control a where a.id=1),true) then
      raise exception 'This week or teacher access is closed.' using errcode='42501';
    end if;
    if jsonb_typeof(payload->'lessons') is distinct from 'array' or jsonb_array_length(payload->'lessons') not between 1 and 100 then
      raise exception 'A valid lesson list is required.';
    end if;
    if submitted and not exists (select 1 from jsonb_array_elements(payload->'lessons') l where btrim(coalesce(l->>'classwork',''))<>'') then
      raise exception 'Write Classwork before submitting.';
    end if;
    if (select count(distinct l->>'slot_id') from jsonb_array_elements(payload->'lessons') l) <> jsonb_array_length(payload->'lessons') then
      raise exception 'Duplicate or missing timetable slots.';
    end if;
    perform pg_advisory_xact_lock(hashtext(v_class_id::text || v_week_id::text));
    select p.id into plan_id from public.weekly_plans p where p.class_id=v_class_id and p.week_id=v_week_id;
    if plan_id is null then
      insert into public.weekly_plans(class_id,week_id,class_teacher_name,status)
      values(v_class_id,v_week_id,staff_name,'draft') returning id into plan_id;
    end if;
    for lesson in select * from jsonb_array_elements(payload->'lessons') loop
      select s.* into slot from public.timetable_slots s
      join public.teacher_assignments a on a.class_id=s.class_id and a.subject_id=s.subject_id and a.teacher_id=s.teacher_id
      where s.id=(lesson->>'slot_id')::uuid and s.teacher_id=target_user_id and s.class_id=v_class_id and s.requires_weekly_plan_submission;
      if not found then raise exception 'A lesson is outside the selected teacher assignments.' using errcode='42501'; end if;
      if exists (select 1 from public.plan_submissions s where s.weekly_plan_id=plan_id and s.teacher_id=target_user_id and s.subject_id=slot.subject_id and s.status in ('submitted','approved')) then
        raise exception 'Withdraw submitted work or use the approved-plan editor.' using errcode='42501';
      end if;
      if length(coalesce(lesson->>'classwork',''))>12000 or length(coalesce(lesson->>'homework',''))>12000 or length(coalesce(lesson->>'classera_notes',''))>12000 then raise exception 'Lesson content is too long.'; end if;
      insert into public.plan_entries(weekly_plan_id,timetable_slot_id,teacher_id,subject_id,day_of_week,period_number,classwork,homework,classera_notes)
      values(plan_id,slot.id,target_user_id,slot.subject_id,slot.day_of_week,slot.period_number,coalesce(lesson->>'classwork',''),coalesce(lesson->>'homework',''),coalesce(lesson->>'classera_notes',''))
      on conflict (weekly_plan_id,day_of_week,period_number) do update
      set classwork=excluded.classwork,homework=excluded.homework,classera_notes=excluded.classera_notes,updated_at=now(),timetable_slot_id=excluded.timetable_slot_id
      where plan_entries.teacher_id=target_user_id and plan_entries.subject_id=excluded.subject_id;
      get diagnostics affected = row_count;
      if affected<>1 then raise exception 'A saved lesson belongs to another teacher or subject.' using errcode='42501'; end if;
      if not slot.subject_id=any(subject_ids) then subject_ids:=array_append(subject_ids,slot.subject_id); end if;
    end loop;
    if payload->>'dictation_note' is not null then
      if not exists (select 1 from public.profiles p join public.departments d on d.id=p.department_id
        where p.user_id=target_user_id and d.name_en='English Department') then
        raise exception 'Only English teachers can change dictation words.' using errcode='42501';
      end if;
      if length(payload->>'dictation_note')>8000 then raise exception 'Dictation is too long.'; end if;
      delete from public.plan_notes where weekly_plan_id=plan_id and teacher_id=target_user_id and starts_with(note_text,'__ENGLISH_DICTATION__');
      if btrim(payload->>'dictation_note')<>'' then insert into public.plan_notes(weekly_plan_id,teacher_id,note_text) values(plan_id,target_user_id,payload->>'dictation_note'); end if;
    end if;
    if nullif(btrim(payload->>'quiz_details'),'') is not null then
      v_subject_id := (payload->>'quiz_subject_id')::uuid;
      if v_subject_id is null or not v_subject_id=any(subject_ids) then raise exception 'Quiz subject is not assigned in this plan.'; end if;
      delete from public.plan_quizzes q where q.weekly_plan_id=plan_id and q.teacher_id=target_user_id and q.subject_id=v_subject_id;
      insert into public.plan_quizzes(weekly_plan_id,teacher_id,subject_id,quiz_date,details) values(plan_id,target_user_id,v_subject_id,(payload->>'quiz_date')::date,payload->>'quiz_details');
    end if;
    submission_status := case when not submitted then 'draft' when supervisor then 'approved' else 'submitted' end;
    foreach v_subject_id in array subject_ids loop
      insert into public.plan_submissions(weekly_plan_id,teacher_id,subject_id,status,submitted_at,reviewed_by,reviewed_at)
      values(plan_id,target_user_id,v_subject_id,submission_status,case when submitted then now() end,
        case when submitted and supervisor then target_user_id end,case when submitted and supervisor then now() end)
      on conflict(weekly_plan_id,teacher_id,subject_id) do update set status=excluded.status,submitted_at=excluded.submitted_at,
        reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,review_note=null,updated_at=now();
    end loop;
    result := to_jsonb(plan_id); context := jsonb_build_object('plan_id',plan_id,'week_id',v_week_id,'class_id',v_class_id,'submitted',submitted,'lesson_count',jsonb_array_length(payload->'lessons'));
  end case;

  perform set_config('request.jwt.claims',coalesce(original_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);
  if operation not in ('get_my_department_teachers','get_my_supervisor_review_queue') then
    insert into public.staff_workspace_audit(actor_id,target_user_id,operation,context) values(actor,target_user_id,operation,context);
  end if;
  return result;
exception when others then
  perform set_config('request.jwt.claims',coalesce(original_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);
  raise;
end;
$$;
revoke all on function public.super_admin_staff_action(uuid,text,jsonb) from public,anon;
grant execute on function public.super_admin_staff_action(uuid,text,jsonb) to authenticated;
commit;
