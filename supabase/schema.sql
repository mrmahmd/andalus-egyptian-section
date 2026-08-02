-- AlAndalus weekly study plan platform
-- Run this file once in the Supabase SQL Editor for the intended project.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_directory (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  account_kind text not null check (account_kind in ('teacher', 'admin')),
  department_id uuid references public.departments(id) on delete restrict,
  administrative_role text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (full_name, account_kind)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  staff_id uuid unique references public.staff_directory(id) on delete restrict,
  username text not null unique check (username = lower(username)),
  display_name text not null,
  role text not null check (role in ('teacher', 'admin', 'super_admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  department_id uuid references public.departments(id) on delete restrict,
  approved_by uuid references public.profiles(user_id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  staff_id uuid not null references public.staff_directory(id) on delete restrict,
  username text not null unique check (username = lower(username)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists one_open_request_per_staff_member
on public.registration_requests (staff_id)
where status in ('pending', 'approved');

create table if not exists public.school_classes (
  id uuid primary key default gen_random_uuid(),
  grade smallint not null check (grade between 1 and 10),
  section text not null check (section in ('A', 'B')),
  is_active boolean not null default true,
  unique (grade, section)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  parent_plan_name text not null,
  department_id uuid references public.departments(id) on delete restrict,
  minimum_grade smallint not null default 1 check (minimum_grade between 1 and 10),
  maximum_grade smallint not null default 10 check (maximum_grade between 1 and 10),
  include_in_weekly_plan boolean not null default true,
  is_active boolean not null default true,
  check (minimum_grade <= maximum_grade)
);

create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  class_id uuid not null references public.school_classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  assigned_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (teacher_id, class_id, subject_id)
);

create table if not exists public.academic_weeks (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  week_number smallint not null check (week_number > 0),
  starts_on date not null,
  ends_on date not null,
  label text not null,
  is_current boolean not null default false,
  unique (academic_year, week_number),
  check (starts_on <= ends_on)
);

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 4),
  period_number smallint not null check (period_number between 1 and 12),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher_id uuid references public.profiles(user_id) on delete set null,
  unique (class_id, day_of_week, period_number)
);

create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.school_classes(id) on delete cascade,
  week_id uuid not null references public.academic_weeks(id) on delete cascade,
  class_teacher_name text not null default 'Mr.Mohamed Farid',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_by uuid references public.profiles(user_id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, week_id)
);

create table if not exists public.plan_entries (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  timetable_slot_id uuid references public.timetable_slots(id) on delete set null,
  teacher_id uuid not null references public.profiles(user_id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 0 and 4),
  period_number smallint not null check (period_number between 1 and 12),
  classwork text not null default '',
  homework text not null default '',
  classera_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_plan_id, day_of_week, period_number)
);

create table if not exists public.plan_quizzes (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  teacher_id uuid not null references public.profiles(user_id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  quiz_date date,
  details text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_notes (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  teacher_id uuid not null references public.profiles(user_id) on delete restrict,
  note_text text not null,
  created_at timestamptz not null default now()
);

create or replace function private.is_active_staff(allowed_roles text[] default array['teacher','admin','super_admin'])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and p.role = any(allowed_roles)
  );
$$;

revoke all on function private.is_active_staff(text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_staff(text[]) to authenticated;

create or replace function public.activate_approved_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_record public.staff_directory%rowtype;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select * into staff_record from public.staff_directory where id = new.staff_id and is_active = true;
    if not found then raise exception 'Staff directory entry is not active'; end if;

    insert into public.profiles (
      user_id, staff_id, username, display_name, role, department_id,
      approved_by, approved_at
    ) values (
      new.user_id, new.staff_id, new.username, staff_record.full_name,
      case when staff_record.account_kind = 'admin' then 'admin' else 'teacher' end,
      staff_record.department_id, new.reviewed_by, coalesce(new.reviewed_at, now())
    )
    on conflict (user_id) do update set
      staff_id = excluded.staff_id,
      username = excluded.username,
      display_name = excluded.display_name,
      role = excluded.role,
      department_id = excluded.department_id,
      status = 'active',
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at,
      updated_at = now();
  end if;
  return new;
end;
$$;

revoke all on function public.activate_approved_registration() from public;

drop trigger if exists registration_approved_profile on public.registration_requests;
create trigger registration_approved_profile
after update of status on public.registration_requests
for each row execute function public.activate_approved_registration();

alter table public.departments enable row level security;
alter table public.staff_directory enable row level security;
alter table public.profiles enable row level security;
alter table public.registration_requests enable row level security;
alter table public.school_classes enable row level security;
alter table public.subjects enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.academic_weeks enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.plan_entries enable row level security;
alter table public.plan_quizzes enable row level security;
alter table public.plan_notes enable row level security;

create policy "Public reads departments" on public.departments for select to anon, authenticated using (true);
create policy "Public reads active staff directory" on public.staff_directory for select to anon, authenticated using (is_active);
create policy "Public reads active classes" on public.school_classes for select to anon, authenticated using (is_active);
create policy "Public reads active subjects" on public.subjects for select to anon, authenticated using (is_active);
create policy "Public reads academic weeks" on public.academic_weeks for select to anon, authenticated using (true);
create policy "Public reads timetable" on public.timetable_slots for select to anon, authenticated using (true);

create policy "Staff read relevant profiles" on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_department_supervisor_for(user_id)) or private.is_active_staff(array['super_admin']));
create policy "Super admin manages profiles" on public.profiles for update to authenticated
using (private.is_active_staff(array['super_admin']))
with check (private.is_active_staff(array['super_admin']));

create policy "Users create their registration request" on public.registration_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');
create policy "Users read their registration request" on public.registration_requests for select to authenticated
using (user_id = (select auth.uid()) or private.is_active_staff(array['super_admin']));
create policy "Super admin reviews registration requests" on public.registration_requests for update to authenticated
using (private.is_active_staff(array['super_admin']))
with check (private.is_active_staff(array['super_admin']));

create policy "Staff read relevant assignments" on public.teacher_assignments for select to authenticated
using (teacher_id = (select auth.uid()) or (select private.is_department_supervisor_for(teacher_id)) or private.is_active_staff(array['super_admin']));
create policy "Supervisors and super admin create relevant assignments" on public.teacher_assignments for insert to authenticated
with check ((select private.is_department_supervisor_for(teacher_id)) or private.is_active_staff(array['super_admin']));
create policy "Supervisors and super admin update relevant assignments" on public.teacher_assignments for update to authenticated
using ((select private.is_department_supervisor_for(teacher_id)) or private.is_active_staff(array['super_admin']))
with check ((select private.is_department_supervisor_for(teacher_id)) or private.is_active_staff(array['super_admin']));
create policy "Supervisors and super admin delete relevant assignments" on public.teacher_assignments for delete to authenticated
using ((select private.is_department_supervisor_for(teacher_id)) or private.is_active_staff(array['super_admin']));

create policy "Public reads published plans" on public.weekly_plans for select to anon
using (status = 'published');
create policy "Active staff reads plans" on public.weekly_plans for select to authenticated
using (status = 'published' or private.is_active_staff());
create policy "Assigned staff creates plan shells" on public.weekly_plans for insert to authenticated
with check (
  private.is_active_staff(array['admin','super_admin'])
  or (
    private.is_active_staff(array['teacher'])
    and exists (select 1 from public.teacher_assignments a where a.teacher_id = (select auth.uid()) and a.class_id = weekly_plans.class_id)
  )
);
create policy "Admins update plans" on public.weekly_plans for update to authenticated
using (private.is_active_staff(array['admin','super_admin']))
with check (private.is_active_staff(array['admin','super_admin']));
create policy "Super admin deletes plans" on public.weekly_plans for delete to authenticated
using (private.is_active_staff(array['super_admin']));

create policy "Public reads published plan entries" on public.plan_entries for select to anon
using (
  exists (
    select 1 from public.weekly_plans p
    join public.plan_submissions s
      on s.weekly_plan_id = p.id
     and s.teacher_id = plan_entries.teacher_id
     and s.subject_id = plan_entries.subject_id
    where p.id = weekly_plan_id and p.status = 'published' and s.status = 'approved'
  )
);
create policy "Active staff reads plan entries" on public.plan_entries for select to authenticated
using (private.is_active_staff());
create policy "Assigned teachers create entries" on public.plan_entries for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and (
    private.is_active_staff(array['admin','super_admin'])
    or (
      private.is_active_staff(array['teacher'])
      and exists (
        select 1 from public.weekly_plans p
        join public.teacher_assignments a on a.class_id = p.class_id
        where p.id = weekly_plan_id and a.teacher_id = (select auth.uid()) and a.subject_id = plan_entries.subject_id
      )
    )
  )
);
create policy "Owners or admins update entries" on public.plan_entries for update to authenticated
using (teacher_id = (select auth.uid()) or private.is_active_staff(array['admin','super_admin']))
with check (teacher_id = (select auth.uid()) or private.is_active_staff(array['admin','super_admin']));
create policy "Owners or super admin delete entries" on public.plan_entries for delete to authenticated
using (teacher_id = (select auth.uid()) or private.is_active_staff(array['super_admin']));

create policy "Public reads published quizzes" on public.plan_quizzes for select to anon
using (
  exists (
    select 1 from public.weekly_plans p
    join public.plan_submissions s
      on s.weekly_plan_id = p.id
     and s.teacher_id = plan_quizzes.teacher_id
     and s.subject_id = plan_quizzes.subject_id
    where p.id = weekly_plan_id and p.status = 'published' and s.status = 'approved'
  )
);
create policy "Active staff reads quizzes" on public.plan_quizzes for select to authenticated using (private.is_active_staff());
create policy "Teachers create their quizzes" on public.plan_quizzes for insert to authenticated
with check (teacher_id = (select auth.uid()) and private.is_active_staff());
create policy "Owners or admins update quizzes" on public.plan_quizzes for update to authenticated
using (teacher_id = (select auth.uid()) or private.is_active_staff(array['admin','super_admin']))
with check (teacher_id = (select auth.uid()) or private.is_active_staff(array['admin','super_admin']));
create policy "Owners or super admin delete quizzes" on public.plan_quizzes for delete to authenticated
using (teacher_id = (select auth.uid()) or private.is_active_staff(array['super_admin']));

create policy "Public reads published notes" on public.plan_notes for select to anon
using (
  exists (
    select 1 from public.weekly_plans p
    join public.plan_submissions s
      on s.weekly_plan_id = p.id
     and s.teacher_id = plan_notes.teacher_id
    where p.id = weekly_plan_id and p.status = 'published' and s.status = 'approved'
  )
);
create policy "Active staff reads notes" on public.plan_notes for select to authenticated using (private.is_active_staff());
create policy "Teachers create their notes" on public.plan_notes for insert to authenticated
with check (teacher_id = (select auth.uid()) and private.is_active_staff());
create policy "Owners or admins update notes" on public.plan_notes for update to authenticated
using (teacher_id = (select auth.uid()) or private.is_active_staff(array['admin','super_admin']))
with check (teacher_id = (select auth.uid()) or private.is_active_staff(array['admin','super_admin']));
create policy "Owners or super admin delete notes" on public.plan_notes for delete to authenticated
using (teacher_id = (select auth.uid()) or private.is_active_staff(array['super_admin']));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.departments, public.staff_directory, public.school_classes, public.subjects, public.academic_weeks, public.timetable_slots to anon, authenticated;
grant select on public.profiles, public.registration_requests, public.teacher_assignments, public.weekly_plans, public.plan_entries, public.plan_quizzes, public.plan_notes to authenticated;
grant insert on public.registration_requests, public.weekly_plans, public.plan_entries, public.plan_quizzes, public.plan_notes to authenticated;
grant update on public.profiles, public.registration_requests, public.weekly_plans, public.plan_entries, public.plan_quizzes, public.plan_notes to authenticated;
grant delete on public.teacher_assignments, public.weekly_plans, public.plan_entries, public.plan_quizzes, public.plan_notes to authenticated;
grant insert, update on public.teacher_assignments to authenticated;
grant select on public.weekly_plans, public.plan_entries, public.plan_quizzes, public.plan_notes to anon;

insert into public.departments (code, name_en, name_ar) values
  ('english', 'English Department', 'شعبة اللغة الإنجليزية'),
  ('arabic_social', 'Arabic & Social Studies Department', 'شعبة اللغة العربية والدراسات'),
  ('math_science', 'Math & Science Department', 'شعبة الرياضيات والعلوم'),
  ('swimming', 'Swimming Department', 'قسم السباحة'),
  ('art', 'Art Department', 'قسم التربية الفنية'),
  ('pe', 'PE Department', 'قسم التربية البدنية'),
  ('ict', 'ICT Department', 'قسم تقنية المعلومات')
on conflict (code) do update set name_en = excluded.name_en, name_ar = excluded.name_ar;

insert into public.staff_directory (full_name, account_kind, department_id)
select v.full_name, 'teacher', d.id
from (values
  ('محمد بدر', 'english'), ('محمد فريد', 'english'), ('عمرو رزق', 'english'),
  ('محمد عبد الحميد', 'english'), ('محمود السكري', 'english'),
  ('محمد سيد بكر', 'arabic_social'), ('محمد حمد', 'arabic_social'), ('محمد سعيد', 'arabic_social'),
  ('محمد شعبان', 'arabic_social'), ('ماجد موسى', 'arabic_social'), ('أحمد سالم', 'arabic_social'),
  ('أحمد حسن', 'arabic_social'), ('محمد فودة', 'arabic_social'), ('عصام الجزار', 'arabic_social'),
  ('وائل شكري', 'arabic_social'),
  ('أحمد عدس', 'math_science'), ('ممدوح بهجت', 'math_science'), ('عبد الناصر خليل', 'math_science'),
  ('عمر أبو شادي', 'math_science'), ('وائل أبو العلا', 'math_science'),
  ('علي بدير', 'art'), ('محمود مدكور', 'ict'), ('محمد سمير', 'ict')
) as v(full_name, department_code)
join public.departments d on d.code = v.department_code
on conflict (full_name, account_kind) do update set department_id = excluded.department_id, is_active = true;

insert into public.staff_directory (full_name, account_kind, department_id, administrative_role)
select v.full_name, 'admin', d.id, v.administrative_role
from (values
  ('محمود حلمي', 'english', 'English Supervisor'),
  ('محمد عثمان', 'arabic_social', 'Arabic Supervisor'),
  ('جمال عبد الرحيم', 'math_science', 'Math & Science Supervisor')
) as v(full_name, department_code, administrative_role)
join public.departments d on d.code = v.department_code
on conflict (full_name, account_kind) do update set department_id = excluded.department_id, administrative_role = excluded.administrative_role, is_active = true;

insert into public.staff_directory (full_name, account_kind, administrative_role) values
  ('همام عبد المنعم', 'admin', 'Vice Principal'),
  ('خالد سعد الدين', 'admin', 'Vice Principal'),
  ('أحمد حجازي', 'admin', 'Vice Principal')
on conflict (full_name, account_kind) do update set administrative_role = excluded.administrative_role, is_active = true;

insert into public.school_classes (grade, section)
select grade, section from generate_series(1, 10) as grades(grade) cross join (values ('A'), ('B')) as sections(section)
on conflict (grade, section) do nothing;

insert into public.subjects (code, name_en, name_ar, parent_plan_name, department_id, minimum_grade, maximum_grade)
select v.code, v.name_en, v.name_ar, v.parent_plan_name, d.id, v.minimum_grade, v.maximum_grade
from (values
  ('arabic', 'Arabic', 'اللغة العربية', 'Arabic', 'arabic_social', 1, 10),
  ('islamic', 'Islamic', 'التربية الإسلامية', 'Islamic', 'arabic_social', 1, 10),
  ('social', 'Social Studies', 'الدراسات الاجتماعية', 'Social', 'arabic_social', 1, 10),
  ('english', 'English', 'اللغة الإنجليزية', 'English', 'english', 1, 6),
  ('connect_plus', 'Connect Plus', 'كونكت بلس', 'English', 'english', 1, 6),
  ('hello', 'English Hello', 'اللغة الإنجليزية - Hello', 'English', 'english', 7, 10),
  ('hello_plus', 'Hello Plus', 'هالو بلس', 'English', 'english', 7, 10),
  ('discover', 'Discover', 'Discover', 'Discover', 'english', 1, 3),
  ('math', 'Math', 'الرياضيات', 'Math', 'math_science', 1, 10),
  ('science', 'Science', 'العلوم', 'Science', 'math_science', 1, 10),
  ('ict', 'ICT', 'تقنية المعلومات', 'ICT', 'ict', 1, 10),
  ('pe', 'PE', 'التربية البدنية', 'PE', 'pe', 1, 10),
  ('swimming', 'Swimming', 'السباحة', 'Swimming', 'swimming', 1, 6),
  ('art', 'Art', 'التربية الفنية', 'Art', 'art', 1, 10)
) as v(code, name_en, name_ar, parent_plan_name, department_code, minimum_grade, maximum_grade)
join public.departments d on d.code = v.department_code
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  parent_plan_name = excluded.parent_plan_name,
  department_id = excluded.department_id,
  minimum_grade = excluded.minimum_grade,
  maximum_grade = excluded.maximum_grade,
  is_active = true;

update public.subjects
set include_in_weekly_plan = false
where code in ('swimming', 'pe');

-- First super-admin bootstrap (run only after creating this Auth user):
-- insert into public.profiles (user_id, username, display_name, role, status, approved_at)
-- select id, 'mohamed.farid', 'Mohamed Farid', 'super_admin', 'active', now()
-- from auth.users where email = 'mohamed.farid@staff.alandalus.school'
-- on conflict (user_id) do update set role = 'super_admin', status = 'active';
