-- Restore the intended parent-facing effect of a Super Admin publication
-- override. The class and week must both be public; only submitted or approved
-- teacher content is eligible, so private drafts and returned work stay hidden.
-- This changes no plan, submission, approval, or publication records.

begin;

create or replace function private.parent_can_read_approved_plan_content(
  target_plan_id uuid,
  target_teacher_id uuid,
  target_subject_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.weekly_plans plan_record
    join public.academic_weeks week_record on week_record.id = plan_record.week_id
    join public.plan_submissions submission
      on submission.weekly_plan_id = plan_record.id
     and submission.teacher_id = target_teacher_id
     and (target_subject_id is null or submission.subject_id = target_subject_id)
    where plan_record.id = target_plan_id
      and plan_record.status = 'published'
      and week_record.parent_portal_visible
      and (
        submission.status = 'approved'
        or (
          plan_record.manual_publication_override
          and submission.status = 'submitted'
        )
      )
  );
$$;

revoke all on function private.parent_can_read_approved_plan_content(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function private.parent_can_read_approved_plan_content(uuid, uuid, uuid)
to anon;

commit;
