-- A secure, reliable directory for the current supervisor's linked teachers.
create or replace function public.get_my_department_teachers()
returns table (
  staff_id uuid,
  user_id uuid,
  display_name text,
  account_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    link.teacher_staff_id,
    teacher.user_id,
    coalesce(teacher.display_name, staff.full_name) as display_name,
    coalesce(teacher.status, 'not_registered') as account_status
  from public.supervisor_staff_links link
  join public.profiles supervisor
    on supervisor.staff_id = link.supervisor_staff_id
  join public.staff_directory staff
    on staff.id = link.teacher_staff_id
  left join public.profiles teacher
    on teacher.staff_id = link.teacher_staff_id
   and teacher.role = 'teacher'
  where supervisor.user_id = (select auth.uid())
    and supervisor.role = 'admin'
    and supervisor.status = 'active'
  order by coalesce(teacher.display_name, staff.full_name);
$$;

revoke all on function public.get_my_department_teachers() from public;
grant execute on function public.get_my_department_teachers() to authenticated;
