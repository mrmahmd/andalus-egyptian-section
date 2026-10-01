begin;

create table if not exists public.weekly_plan_announcements (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.academic_weeks(id) on delete cascade,
  class_id uuid not null references public.school_classes(id) on delete cascade,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, class_id)
);

create table if not exists public.farid_weekly_quizzes (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.academic_weeks(id) on delete cascade,
  class_id uuid not null references public.school_classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(user_id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 0 and 4),
  programme text not null check (programme in ('English OL', 'Connect Plus')),
  content text not null check (char_length(btrim(content)) between 1 and 2500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, class_id, teacher_id, day_of_week, programme)
);

create index if not exists weekly_plan_announcements_class_week_idx
  on public.weekly_plan_announcements (class_id, week_id);
create index if not exists farid_weekly_quizzes_class_week_idx
  on public.farid_weekly_quizzes (class_id, week_id);

alter table public.weekly_plan_announcements enable row level security;
alter table public.farid_weekly_quizzes enable row level security;

-- The production schema may already have been applied through the SQL Editor.
-- Keep this migration safe when the CLI later records it in migration history.
drop policy if exists "Parents read announcements for visible published plans" on public.weekly_plan_announcements;
drop policy if exists "Farid super admin reads own announcements" on public.weekly_plan_announcements;
drop policy if exists "Farid super admin creates announcements" on public.weekly_plan_announcements;
drop policy if exists "Farid super admin updates own announcements" on public.weekly_plan_announcements;
drop policy if exists "Farid super admin deletes own announcements" on public.weekly_plan_announcements;
drop policy if exists "Parents read approved Farid quizzes" on public.farid_weekly_quizzes;
drop policy if exists "Farid teacher reads own quizzes" on public.farid_weekly_quizzes;
drop policy if exists "Farid teacher creates assigned quizzes" on public.farid_weekly_quizzes;
drop policy if exists "Farid teacher updates own assigned quizzes" on public.farid_weekly_quizzes;
drop policy if exists "Farid teacher deletes own quizzes" on public.farid_weekly_quizzes;

create policy "Parents read announcements for visible published plans"
on public.weekly_plan_announcements for select to anon
using (exists (
  select 1 from public.weekly_plans plan_record
  join public.academic_weeks week_record on week_record.id = plan_record.week_id
  where plan_record.class_id = weekly_plan_announcements.class_id
    and plan_record.week_id = weekly_plan_announcements.week_id
    and plan_record.status = 'published'
    and week_record.parent_portal_visible
));

create policy "Farid super admin reads own announcements"
on public.weekly_plan_announcements for select to authenticated
using (created_by = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  where profile.user_id = (select auth.uid())
    and profile.username = 'mohamed.farid'
    and profile.role = 'super_admin' and profile.status = 'active'
));

create policy "Farid super admin creates announcements"
on public.weekly_plan_announcements for insert to authenticated
with check (created_by = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  where profile.user_id = (select auth.uid())
    and profile.username = 'mohamed.farid'
    and profile.role = 'super_admin' and profile.status = 'active'
));

create policy "Farid super admin updates own announcements"
on public.weekly_plan_announcements for update to authenticated
using (created_by = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  where profile.user_id = (select auth.uid())
    and profile.username = 'mohamed.farid'
    and profile.role = 'super_admin' and profile.status = 'active'
))
with check (created_by = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  where profile.user_id = (select auth.uid())
    and profile.username = 'mohamed.farid'
    and profile.role = 'super_admin' and profile.status = 'active'
));

create policy "Farid super admin deletes own announcements"
on public.weekly_plan_announcements for delete to authenticated
using (created_by = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  where profile.user_id = (select auth.uid())
    and profile.username = 'mohamed.farid'
    and profile.role = 'super_admin' and profile.status = 'active'
));

create policy "Parents read approved Farid quizzes"
on public.farid_weekly_quizzes for select to anon
using (exists (
  select 1 from public.weekly_plans plan_record
  where plan_record.class_id = farid_weekly_quizzes.class_id
    and plan_record.week_id = farid_weekly_quizzes.week_id
    and (select private.parent_can_read_approved_plan_content(
      plan_record.id, farid_weekly_quizzes.teacher_id, farid_weekly_quizzes.subject_id
    ))
));

create policy "Farid teacher reads own quizzes"
on public.farid_weekly_quizzes for select to authenticated
using (teacher_id = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  where profile.user_id = (select auth.uid())
    and profile.username = 'mrmahmd'
    and profile.role = 'teacher' and profile.status = 'active'
));

create policy "Farid teacher creates assigned quizzes"
on public.farid_weekly_quizzes for insert to authenticated
with check (teacher_id = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  join public.teacher_assignments assignment
    on assignment.teacher_id = profile.user_id
   and assignment.class_id = farid_weekly_quizzes.class_id
   and assignment.subject_id = farid_weekly_quizzes.subject_id
  join public.subjects subject on subject.id = assignment.subject_id
  where profile.user_id = (select auth.uid())
    and profile.username = 'mrmahmd'
    and profile.role = 'teacher' and profile.status = 'active'
    and ((farid_weekly_quizzes.programme = 'English OL' and subject.name_en = 'English OL')
      or (farid_weekly_quizzes.programme = 'Connect Plus' and subject.name_en = 'English AL'))
));

create policy "Farid teacher updates own assigned quizzes"
on public.farid_weekly_quizzes for update to authenticated
using (teacher_id = (select auth.uid()))
with check (teacher_id = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  join public.teacher_assignments assignment
    on assignment.teacher_id = profile.user_id
   and assignment.class_id = farid_weekly_quizzes.class_id
   and assignment.subject_id = farid_weekly_quizzes.subject_id
  join public.subjects subject on subject.id = assignment.subject_id
  where profile.user_id = (select auth.uid())
    and profile.username = 'mrmahmd'
    and profile.role = 'teacher' and profile.status = 'active'
    and ((farid_weekly_quizzes.programme = 'English OL' and subject.name_en = 'English OL')
      or (farid_weekly_quizzes.programme = 'Connect Plus' and subject.name_en = 'English AL'))
));

create policy "Farid teacher deletes own quizzes"
on public.farid_weekly_quizzes for delete to authenticated
using (teacher_id = (select auth.uid()) and exists (
  select 1 from public.profiles profile
  where profile.user_id = (select auth.uid())
    and profile.username = 'mrmahmd'
    and profile.role = 'teacher' and profile.status = 'active'
));

revoke all on public.weekly_plan_announcements, public.farid_weekly_quizzes from public, anon, authenticated;
grant select on public.weekly_plan_announcements, public.farid_weekly_quizzes to anon, authenticated;
grant insert, update, delete on public.weekly_plan_announcements, public.farid_weekly_quizzes to authenticated;

commit;
