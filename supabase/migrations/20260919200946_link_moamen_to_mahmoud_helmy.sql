begin;

-- Moamen El Haddad belongs to the English supervisor Mahmoud Helmy.
-- Use account usernames so the relationship remains unambiguous if display
-- names are adjusted later.
do $$
begin
  if not exists (
    select 1
    from public.profiles teacher
    where teacher.username = 'moamen'
      and teacher.role = 'teacher'
      and teacher.status = 'active'
      and teacher.staff_id is not null
  ) then
    raise exception 'Active teacher account moamen was not found';
  end if;

  if not exists (
    select 1
    from public.profiles supervisor
    where supervisor.username = 'mhelmy'
      and supervisor.role = 'admin'
      and supervisor.status = 'active'
      and supervisor.staff_id is not null
  ) then
    raise exception 'Active supervisor account mhelmy was not found';
  end if;
end $$;

insert into public.supervisor_staff_links (
  supervisor_staff_id,
  teacher_staff_id,
  assigned_by
)
select supervisor.staff_id, teacher.staff_id, (select auth.uid())
from public.profiles teacher
cross join public.profiles supervisor
where teacher.username = 'moamen'
  and teacher.role = 'teacher'
  and teacher.status = 'active'
  and supervisor.username = 'mhelmy'
  and supervisor.role = 'admin'
  and supervisor.status = 'active'
on conflict (supervisor_staff_id, teacher_staff_id) do nothing;

commit;
