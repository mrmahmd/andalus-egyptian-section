-- Validation only. Every write, including audit rows, is rolled back.
begin;
create temporary table workspace_check_context as
select actor.user_id actor_id, teacher.user_id teacher_id, slot.id slot_id, slot.class_id, week.id week_id
from public.profiles actor
cross join public.profiles teacher
join public.staff_directory staff on staff.id=teacher.staff_id and staff.is_active
join public.timetable_slots slot on slot.teacher_id=teacher.user_id and slot.requires_weekly_plan_submission
join public.teacher_assignments assignment on assignment.teacher_id=teacher.user_id and assignment.class_id=slot.class_id and assignment.subject_id=slot.subject_id
cross join public.academic_weeks week
where actor.role='super_admin' and actor.status='active' and teacher.role='teacher' and teacher.status='active'
and week.teacher_entry_enabled
and not exists(select 1 from public.weekly_plans plan join public.plan_submissions submission on submission.weekly_plan_id=plan.id
 where plan.class_id=slot.class_id and plan.week_id=week.id and submission.teacher_id=teacher.user_id and submission.subject_id=slot.subject_id and submission.status in ('submitted','approved'))
order by (week.week_number=6) desc, week.week_number, teacher.display_name
limit 1;
do $$ begin if not exists(select 1 from workspace_check_context) then raise exception 'No suitable open draft context. Nothing was changed.'; end if; end $$;
create temporary table workspace_check_results(result jsonb);
grant select on workspace_check_context to authenticated;
grant insert,select on workspace_check_results to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated')::text,true),set_config('request.jwt.claim.sub',actor_id::text,true) from workspace_check_context;
set local role authenticated;
do $$
declare c record; saved_plan uuid; saved_teacher uuid; audit_actor uuid; actual_actor uuid;
begin
 select * into c from workspace_check_context;
 perform public.super_admin_staff_action(c.teacher_id,'open_workspace','{}');
 saved_plan := (public.super_admin_staff_action(c.teacher_id,'save_staff_plan',jsonb_build_object('class_id',c.class_id,'week_id',c.week_id,'submit',false,'lessons',jsonb_build_array(jsonb_build_object('slot_id',c.slot_id,'classwork','Rollback validation only','homework','','classera_notes','')))) #>> '{}')::uuid;
 select teacher_id into saved_teacher from public.plan_entries where weekly_plan_id=saved_plan and timetable_slot_id=c.slot_id;
 select actor_id into audit_actor from public.staff_workspace_audit where target_user_id=c.teacher_id and operation='save_staff_plan' order by created_at desc limit 1;
 actual_actor := auth.uid();
 if saved_teacher is distinct from c.teacher_id or audit_actor is distinct from c.actor_id or actual_actor is distinct from c.actor_id then raise exception 'Delegated save or attribution failed'; end if;
 insert into workspace_check_results values(jsonb_build_object('saved_as_selected_teacher',true,'audit_actor_is_general_supervisor',true,'session_identity_restored',true,'rolled_back_after_check',true));
end $$;
reset role;
select result from workspace_check_results;
rollback;
