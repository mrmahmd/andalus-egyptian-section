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
  programme.code,
  programme.name_en,
  programme.name_ar,
  programme.parent_plan_name,
  departments.id,
  programme.minimum_grade,
  programme.maximum_grade,
  true,
  true
from (values
  ('english', 'English', 'اللغة الإنجليزية', 'English', 1, 6),
  ('connect_plus', 'Connect Plus', 'كونكت بلس', 'English', 1, 6),
  ('hello', 'English Hello', 'اللغة الإنجليزية - Hello', 'English', 7, 10),
  ('hello_plus', 'Hello Plus', 'هالو بلس', 'English', 7, 10),
  ('discover', 'Discover', 'ديسكفر', 'Discover', 1, 3)
) as programme(code, name_en, name_ar, parent_plan_name, minimum_grade, maximum_grade)
join public.departments on departments.code = 'english'
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  parent_plan_name = excluded.parent_plan_name,
  department_id = excluded.department_id,
  minimum_grade = excluded.minimum_grade,
  maximum_grade = excluded.maximum_grade,
  include_in_weekly_plan = true,
  is_active = true;

select code, name_en, parent_plan_name, minimum_grade, maximum_grade
from public.subjects
where code in ('english', 'connect_plus', 'hello', 'hello_plus', 'discover')
order by minimum_grade, name_en;
