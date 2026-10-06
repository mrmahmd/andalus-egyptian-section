begin;

-- An explicit teacher/class/week exception, separate from supervisor decisions
-- and from the existing whole-class publication override. No plan is changed
-- merely by installing this script or opening a staff workspace.
create table if not exists public.teacher_plan_publication_overrides (
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  teacher_id uuid not null,
  published_by uuid not null,
  published_at timestamptz not null default now(),
  primary key (weekly_plan_id, teacher_id)
);
alter table public.teacher_plan_publication_overrides enable row level security;
revoke all on public.teacher_plan_publication_overrides from anon, authenticated;
grant select on public.teacher_plan_publication_overrides to authenticated;
drop policy if exists "Owner reads exceptional publications" on public.teacher_plan_publication_overrides;
create policy "Owner reads exceptional publications"
on public.teacher_plan_publication_overrides for select to authenticated
using ((select private.is_active_staff(array['super_admin'])));

-- Preserve the current readiness implementation rather than rebuilding it.
do $$ begin
  if to_regprocedure('private.refresh_weekly_plan_without_teacher_override(uuid)') is null then
    alter function private.refresh_weekly_plan_publication_state(uuid)
      rename to refresh_weekly_plan_without_teacher_override;
  end if;
end $$;

create or replace function private.refresh_weekly_plan_publication_state(target_plan_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare exceptional_actor uuid;
begin
  select exception_record.published_by into exceptional_actor
  from public.teacher_plan_publication_overrides exception_record
  where exception_record.weekly_plan_id = target_plan_id
    and exists (
      select 1 from public.plan_entries entry
      where entry.weekly_plan_id = target_plan_id
        and entry.teacher_id = exception_record.teacher_id
        and (btrim(coalesce(entry.classwork,'')) <> '' or btrim(coalesce(entry.homework,'')) <> '' or btrim(coalesce(entry.classera_notes,'')) <> '')
    ) order by exception_record.published_at limit 1;
  if exceptional_actor is not null then
    update public.weekly_plans set status = 'published',
      published_by = coalesce(published_by, exceptional_actor),
      published_at = coalesce(published_at, now()), updated_at = now()
    where id = target_plan_id;
    return true;
  end if;
  return private.refresh_weekly_plan_without_teacher_override(target_plan_id);
end $$;
revoke all on function private.refresh_weekly_plan_publication_state(uuid) from public;

create or replace function public.publish_teacher_plan_exceptionally(target_plan_id uuid, target_teacher_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_class_id uuid; inserted_count integer;
begin
  if auth.uid() is null or not private.is_active_staff(array['super_admin']) then
    raise exception 'Only the active General Supervisor can publish exceptionally.' using errcode = '42501';
  end if;
  select class_id into target_class_id from public.weekly_plans
  where id = target_plan_id for update;
  if not found then raise exception 'Weekly plan not found.'; end if;
  if not exists (
    select 1 from public.plan_entries entry
    join public.profiles teacher on teacher.user_id = entry.teacher_id
    join public.plan_submissions submission on submission.weekly_plan_id = entry.weekly_plan_id
      and submission.teacher_id = entry.teacher_id and submission.subject_id = entry.subject_id
    where entry.weekly_plan_id = target_plan_id and entry.teacher_id = target_teacher_id
      and teacher.status = 'active' and teacher.role in ('teacher','admin')
      and (btrim(coalesce(entry.classwork,'')) <> '' or btrim(coalesce(entry.homework,'')) <> '' or btrim(coalesce(entry.classera_notes,'')) <> '')
      and exists (select 1 from public.timetable_slots slot
        join public.subjects subject_record on subject_record.id = slot.subject_id
        where slot.class_id = target_class_id and slot.teacher_id = target_teacher_id
          and slot.subject_id = entry.subject_id and slot.requires_weekly_plan_submission
          and subject_record.include_in_weekly_plan)
  ) then raise exception 'This teacher has no assigned, saved plan content to publish.'; end if;
  insert into public.teacher_plan_publication_overrides(weekly_plan_id,teacher_id,published_by)
  values(target_plan_id,target_teacher_id,auth.uid()) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  perform private.refresh_weekly_plan_publication_state(target_plan_id);
  return inserted_count > 0;
end $$;
revoke all on function public.publish_teacher_plan_exceptionally(uuid,uuid) from public, anon;
grant execute on function public.publish_teacher_plan_exceptionally(uuid,uuid) to authenticated;

-- Confirmed target pairs freeze the scope visible in the confirmation dialog.
-- The whole batch is one transaction; failure cannot leave a partial batch.
create or replace function public.publish_week_teacher_plans_exceptionally(target_week_id uuid, targets jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare target record; published_count integer := 0;
begin
  if auth.uid() is null or not private.is_active_staff(array['super_admin']) then
    raise exception 'Only the active General Supervisor can publish exceptionally.' using errcode = '42501';
  end if;
  if jsonb_typeof(targets) is distinct from 'array' or jsonb_array_length(targets) = 0 then
    raise exception 'Select at least one teacher plan.';
  end if;
  if exists (select 1 from jsonb_to_recordset(targets) as pair(plan_id uuid,teacher_id uuid)
    left join public.weekly_plans plan on plan.id = pair.plan_id
    where plan.id is null or plan.week_id is distinct from target_week_id or pair.teacher_id is null) then
    raise exception 'All selected teacher plans must belong to the confirmed week.';
  end if;
  for target in select distinct pair.plan_id,pair.teacher_id
    from jsonb_to_recordset(targets) as pair(plan_id uuid,teacher_id uuid)
    where exists (select 1 from public.plan_submissions submission
      where submission.weekly_plan_id = pair.plan_id and submission.teacher_id = pair.teacher_id
        and submission.status <> 'approved')
    order by pair.plan_id,pair.teacher_id
  loop
    if public.publish_teacher_plan_exceptionally(target.plan_id,target.teacher_id) then
      published_count := published_count + 1;
    end if;
  end loop;
  return published_count;
end $$;
revoke all on function public.publish_week_teacher_plans_exceptionally(uuid,jsonb) from public, anon;
grant execute on function public.publish_week_teacher_plans_exceptionally(uuid,jsonb) to authenticated;

create or replace function private.parent_can_read_approved_plan_content(
  target_plan_id uuid, target_teacher_id uuid, target_subject_id uuid default null
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.weekly_plans plan_record
    join public.academic_weeks week_record on week_record.id = plan_record.week_id
    join public.plan_submissions submission on submission.weekly_plan_id = plan_record.id
      and submission.teacher_id = target_teacher_id
      and (target_subject_id is null or submission.subject_id = target_subject_id)
    where plan_record.id = target_plan_id and plan_record.status = 'published'
      and week_record.parent_portal_visible
      and (submission.status = 'approved'
        or (plan_record.manual_publication_override and submission.status = 'submitted')
        or exists (select 1 from public.teacher_plan_publication_overrides exception_record
          where exception_record.weekly_plan_id = target_plan_id and exception_record.teacher_id = target_teacher_id))
  );
$$;
revoke all on function private.parent_can_read_approved_plan_content(uuid,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function private.parent_can_read_approved_plan_content(uuid,uuid,uuid) to anon;

commit;
