-- Add French and the two approved staff members to the English department.
-- This migration is idempotent and can be run safely more than once.

insert into public.staff_directory (full_name, account_kind, department_id, is_active)
select staff.full_name, 'teacher', department.id, true
from (values
  ('محمد النمر'),
  ('أسامة حسن')
) as staff(full_name)
join public.departments department on department.code = 'english'
on conflict (full_name, account_kind) do update set
  department_id = excluded.department_id,
  is_active = true;

insert into public.subjects (
  code,
  name_en,
  name_ar,
  parent_plan_name,
  department_id,
  minimum_grade,
  maximum_grade,
  include_in_weekly_plan,
  is_active
)
select
  'french',
  'French',
  'اللغة الفرنسية',
  'French',
  department.id,
  5,
  10,
  true,
  true
from public.departments department
where department.code = 'english'
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  parent_plan_name = excluded.parent_plan_name,
  department_id = excluded.department_id,
  minimum_grade = excluded.minimum_grade,
  maximum_grade = excluded.maximum_grade,
  include_in_weekly_plan = true,
  is_active = true;

insert into public.supervisor_staff_links (supervisor_staff_id, teacher_staff_id)
select supervisor.id, teacher.id
from public.staff_directory supervisor
join public.staff_directory teacher
  on teacher.full_name in ('محمد النمر', 'أسامة حسن')
 and teacher.account_kind = 'teacher'
where supervisor.full_name = 'محمود حلمي'
  and supervisor.account_kind = 'admin'
on conflict (supervisor_staff_id, teacher_staff_id) do nothing;

select
  teacher.full_name,
  department.name_en as department,
  supervisor.full_name as supervisor
from public.staff_directory teacher
join public.departments department on department.id = teacher.department_id
left join public.supervisor_staff_links link on link.teacher_staff_id = teacher.id
left join public.staff_directory supervisor on supervisor.id = link.supervisor_staff_id
where teacher.full_name in ('محمد النمر', 'أسامة حسن')
order by teacher.full_name;

select code, name_en, name_ar, minimum_grade, maximum_grade, include_in_weekly_plan
from public.subjects
where code = 'french';
