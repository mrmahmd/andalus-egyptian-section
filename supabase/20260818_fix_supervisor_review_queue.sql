-- Return the signed-in supervisor's review queue through one secured RPC.
-- This avoids fragile client-side nested joins and keeps the scope restricted
-- to teachers explicitly linked to the active supervisor.

create or replace function public.get_my_supervisor_review_queue()
returns table (
  id uuid,
  weekly_plan_id uuid,
  status text,
  review_note text,
  submitted_at timestamptz,
  teacher_id uuid,
  teacher_name text,
  subject_id uuid,
  subject_name text,
  class_id uuid,
  grade integer,
  section text,
  week_id uuid,
  week_label text,
  entries jsonb,
  quizzes jsonb,
  weekly_notes jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_supervisor as (
    select profile.staff_id
    from public.profiles profile
    join public.staff_directory staff on staff.id = profile.staff_id
    where profile.user_id = (select auth.uid())
      and profile.role = 'admin'
      and profile.status = 'active'
      and staff.administrative_role like '%Supervisor%'
  )
  select
    submission.id,
    submission.weekly_plan_id,
    submission.status,
    submission.review_note,
    submission.submitted_at,
    submission.teacher_id,
    coalesce(teacher.display_name, teacher_staff.full_name) as teacher_name,
    submission.subject_id,
    subject.name_en as subject_name,
    plan.class_id,
    school_class.grade,
    school_class.section,
    plan.week_id,
    academic_week.label as week_label,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_of_week', entry.day_of_week,
        'period_number', entry.period_number,
        'teacher_id', entry.teacher_id,
        'subject_id', entry.subject_id,
        'classwork', entry.classwork,
        'homework', entry.homework,
        'classera_notes', entry.classera_notes
      ) order by entry.day_of_week, entry.period_number)
      from public.plan_entries entry
      where entry.weekly_plan_id = submission.weekly_plan_id
        and entry.teacher_id = submission.teacher_id
        and entry.subject_id = submission.subject_id
    ), '[]'::jsonb) as entries,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject', quiz_subject.name_en,
        'quiz_date', quiz.quiz_date,
        'details', quiz.details
      ) order by quiz.quiz_date nulls last, quiz.created_at)
      from public.plan_quizzes quiz
      join public.subjects quiz_subject on quiz_subject.id = quiz.subject_id
      where quiz.weekly_plan_id = submission.weekly_plan_id
        and quiz.teacher_id = submission.teacher_id
        and quiz.subject_id = submission.subject_id
    ), '[]'::jsonb) as quizzes,
    coalesce((
      select jsonb_agg(note.note_text order by note.created_at)
      from public.plan_notes note
      where note.weekly_plan_id = submission.weekly_plan_id
        and note.teacher_id = submission.teacher_id
    ), '[]'::jsonb) as weekly_notes
  from current_supervisor supervisor
  join public.supervisor_staff_links link
    on link.supervisor_staff_id = supervisor.staff_id
  join public.profiles teacher
    on teacher.staff_id = link.teacher_staff_id
   and teacher.role = 'teacher'
   and teacher.status = 'active'
  join public.staff_directory teacher_staff on teacher_staff.id = teacher.staff_id
  join public.plan_submissions submission
    on submission.teacher_id = teacher.user_id
   and submission.status in ('submitted', 'changes_requested', 'approved')
  join public.weekly_plans plan on plan.id = submission.weekly_plan_id
  join public.school_classes school_class on school_class.id = plan.class_id
  join public.academic_weeks academic_week on academic_week.id = plan.week_id
  join public.subjects subject on subject.id = submission.subject_id
  order by submission.submitted_at desc nulls last, coalesce(teacher.display_name, teacher_staff.full_name), school_class.grade, school_class.section;
$$;

revoke all on function public.get_my_supervisor_review_queue() from public;
grant execute on function public.get_my_supervisor_review_queue() to authenticated;
