-- Link the Art teacher Ali Badir to Arabic supervisor Mohamed Othman.
-- Usernames make this operation stable across environments, and the conflict
-- guard keeps it safe to run more than once.

insert into public.supervisor_staff_links (supervisor_staff_id, teacher_staff_id)
select supervisor.staff_id, teacher.staff_id
from public.profiles supervisor
cross join public.profiles teacher
where supervisor.username = 'mohasay012345'
  and supervisor.role = 'admin'
  and supervisor.status = 'active'
  and teacher.username = 'aabuzaid1973'
  and teacher.role = 'teacher'
  and teacher.status = 'active'
on conflict (supervisor_staff_id, teacher_staff_id) do nothing;
