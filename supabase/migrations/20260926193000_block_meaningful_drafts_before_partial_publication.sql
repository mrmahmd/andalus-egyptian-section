begin;

-- Keep partial publication for teachers who have not started at all, but do
-- not publish the class while any teacher has real draft work still being
-- written, a submitted plan awaiting review, or requested changes pending.
create or replace function private.refresh_weekly_plan_publication_state(target_plan_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_is_ready boolean := false;
  has_manual_override boolean := false;
begin
  select coalesce(plan_record.manual_publication_override, false)
  into has_manual_override
  from public.weekly_plans plan_record
  where plan_record.id = target_plan_id;

  if has_manual_override then
    update public.weekly_plans
    set status = 'published',
        published_by = coalesce(publication_override_by, published_by),
        published_at = coalesce(published_at, publication_override_at, now()),
        updated_at = now()
    where id = target_plan_id;
    return true;
  end if;

  select
    exists (
      select 1
      from public.plan_submissions approved_submission
      join public.weekly_plans plan_record
        on plan_record.id = approved_submission.weekly_plan_id
      where approved_submission.weekly_plan_id = target_plan_id
        and approved_submission.status = 'approved'
        and exists (
          select 1
          from public.timetable_slots slot
          join public.subjects subject_record on subject_record.id = slot.subject_id
          where slot.class_id = plan_record.class_id
            and slot.teacher_id = approved_submission.teacher_id
            and slot.subject_id = approved_submission.subject_id
            and slot.requires_weekly_plan_submission
            and subject_record.include_in_weekly_plan
            and not exists (
              select 1
              from public.weekly_plan_holidays holiday
              where holiday.week_id = plan_record.week_id
                and holiday.day_of_week = slot.day_of_week
            )
        )
        and exists (
          select 1
          from public.plan_entries entry
          where entry.weekly_plan_id = approved_submission.weekly_plan_id
            and entry.teacher_id = approved_submission.teacher_id
            and entry.subject_id = approved_submission.subject_id
            and (
              btrim(coalesce(entry.classwork, '')) <> ''
              or btrim(coalesce(entry.homework, '')) <> ''
              or btrim(coalesce(entry.classera_notes, '')) <> ''
            )
        )
    )
    and not exists (
      select 1
      from public.plan_submissions unresolved_submission
      join public.weekly_plans plan_record
        on plan_record.id = unresolved_submission.weekly_plan_id
      where unresolved_submission.weekly_plan_id = target_plan_id
        and (
          unresolved_submission.status in ('submitted', 'changes_requested')
          or (
            unresolved_submission.status = 'draft'
            and exists (
              select 1
              from public.plan_entries draft_entry
              where draft_entry.weekly_plan_id = unresolved_submission.weekly_plan_id
                and draft_entry.teacher_id = unresolved_submission.teacher_id
                and draft_entry.subject_id = unresolved_submission.subject_id
                and (
                  btrim(coalesce(draft_entry.classwork, '')) <> ''
                  or btrim(coalesce(draft_entry.homework, '')) <> ''
                  or btrim(coalesce(draft_entry.classera_notes, '')) <> ''
                )
            )
          )
        )
        and exists (
          select 1
          from public.timetable_slots slot
          join public.subjects subject_record on subject_record.id = slot.subject_id
          where slot.class_id = plan_record.class_id
            and slot.teacher_id = unresolved_submission.teacher_id
            and slot.subject_id = unresolved_submission.subject_id
            and slot.requires_weekly_plan_submission
            and subject_record.include_in_weekly_plan
            and not exists (
              select 1
              from public.weekly_plan_holidays holiday
              where holiday.week_id = plan_record.week_id
                and holiday.day_of_week = slot.day_of_week
            )
        )
    )
  into plan_is_ready;

  update public.weekly_plans
  set status = case when plan_is_ready then 'published' else 'draft' end,
      published_by = case when plan_is_ready then coalesce(published_by, (select auth.uid())) else null end,
      published_at = case when plan_is_ready then coalesce(published_at, now()) else null end,
      updated_at = now()
  where id = target_plan_id;

  return coalesce(plan_is_ready, false);
end;
$$;

revoke all on function private.refresh_weekly_plan_publication_state(uuid) from public;

-- Correct every existing class/week immediately, including any plan that was
-- marked published while another teacher still had meaningful draft work.
select private.refresh_weekly_plan_publication_state(id)
from public.weekly_plans;

commit;
