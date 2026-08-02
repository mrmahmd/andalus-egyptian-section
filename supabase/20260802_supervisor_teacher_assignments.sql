-- Department supervisors can manage classes and subjects for only their linked teachers.

drop policy if exists "Users read their profile" on public.profiles;
create policy "Staff read relevant profiles" on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_department_supervisor_for(user_id))
  or private.is_active_staff(array['super_admin'])
);

drop policy if exists "Staff read assignments" on public.teacher_assignments;
create policy "Staff read relevant assignments" on public.teacher_assignments for select to authenticated
using (
  teacher_id = (select auth.uid())
  or (select private.is_department_supervisor_for(teacher_id))
  or private.is_active_staff(array['super_admin'])
);

drop policy if exists "Super admin creates assignments" on public.teacher_assignments;
create policy "Supervisors and super admin create relevant assignments" on public.teacher_assignments for insert to authenticated
with check (
  (select private.is_department_supervisor_for(teacher_id))
  or private.is_active_staff(array['super_admin'])
);

drop policy if exists "Super admin updates assignments" on public.teacher_assignments;
create policy "Supervisors and super admin update relevant assignments" on public.teacher_assignments for update to authenticated
using (
  (select private.is_department_supervisor_for(teacher_id))
  or private.is_active_staff(array['super_admin'])
)
with check (
  (select private.is_department_supervisor_for(teacher_id))
  or private.is_active_staff(array['super_admin'])
);

drop policy if exists "Super admin deletes assignments" on public.teacher_assignments;
create policy "Supervisors and super admin delete relevant assignments" on public.teacher_assignments for delete to authenticated
using (
  (select private.is_department_supervisor_for(teacher_id))
  or private.is_active_staff(array['super_admin'])
);
