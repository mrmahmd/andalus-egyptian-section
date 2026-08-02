-- Department-supervisor workflow for the AlAndalus weekly-plan platform.
-- Supervisors remain Admin accounts, retain their own teaching assignments,
-- and review submissions only from teachers in their own department.

create table if not exists public.plan_submissions (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'changes_requested', 'approved')),
  review_note text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_plan_id, teacher_id, subject_id)
);

create index if not exists plan_submissions_teacher_status_idx on public.plan_submissions (teacher_id, status);
create index if not exists plan_submissions_plan_idx on public.plan_submissions (weekly_plan_id);
create index if not exists profiles_department_idx on public.profiles (department_id);

create or replace function private.is_department_supervisor_for(target_teacher_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles supervisor
    join public.staff_directory staff on staff.id = supervisor.staff_id
    join public.profiles teacher on teacher.user_id = target_teacher_id
    where supervisor.user_id = (select auth.uid())
      and supervisor.role = 'admin'
      and supervisor.status = 'active'
      and staff.administrative_role like '%Supervisor%'
      and supervisor.department_id is not null
      and supervisor.department_id = teacher.department_id
  );
$$;

revoke all on function private.is_department_supervisor_for(uuid) from public;
grant execute on function private.is_department_supervisor_for(uuid) to authenticated;

alter table public.plan_submissions enable row level security;

create policy "Teachers and supervisors read relevant submissions" on public.plan_submissions for select to authenticated
using (
  teacher_id = (select auth.uid())
  or (select private.is_department_supervisor_for(teacher_id))
  or private.is_active_staff(array['super_admin'])
);

create policy "Teachers create their own submissions" on public.plan_submissions for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and status in ('draft', 'submitted')
);

create policy "Teachers update their own submissions" on public.plan_submissions for update to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and status in ('draft', 'submitted')
  and reviewed_by is null
);

create policy "Super admin manages submissions" on public.plan_submissions for all to authenticated
using (private.is_active_staff(array['super_admin']))
with check (private.is_active_staff(array['super_admin']));

grant select, insert, update on public.plan_submissions to authenticated;

create or replace function public.review_plan_submission(
  submission_id uuid,
  decision text,
  note text default null
)
returns public.plan_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission public.plan_submissions%rowtype;
  next_status text;
begin
  if decision not in ('approved', 'changes_requested') then
    raise exception 'Invalid review decision';
  end if;

  select * into submission
  from public.plan_submissions
  where id = submission_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  if not (
    (select private.is_department_supervisor_for(submission.teacher_id))
    or (select private.is_active_staff(array['super_admin']))
  ) then
    raise exception 'Not authorized to review this submission';
  end if;

  if decision = 'changes_requested' and coalesce(btrim(note), '') = '' then
    raise exception 'A review note is required when requesting changes';
  end if;

  next_status := decision;
  update public.plan_submissions
  set status = next_status,
      review_note = nullif(btrim(note), ''),
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where id = submission_id
  returning * into submission;

  return submission;
end;
$$;

revoke all on function public.review_plan_submission(uuid, text, text) from public;
grant execute on function public.review_plan_submission(uuid, text, text) to authenticated;
