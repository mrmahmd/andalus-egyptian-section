create or replace function private.is_farid_experiment()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid())
      and status = 'active'
      and display_name = 'محمد فريد'
  );
$$;

drop policy if exists "Farid publishes experiment plans" on public.weekly_plans;
create policy "Farid publishes experiment plans" on public.weekly_plans
for update to authenticated
using (private.is_farid_experiment() and exists (
  select 1 from public.teacher_assignments a
  where a.teacher_id = (select auth.uid()) and a.class_id = weekly_plans.class_id
))
with check (private.is_farid_experiment() and status in ('draft', 'published'));

drop policy if exists "Farid creates approved experiment submission" on public.plan_submissions;
create policy "Farid creates approved experiment submission" on public.plan_submissions
for insert to authenticated
with check (private.is_farid_experiment() and teacher_id = (select auth.uid()) and status = 'approved');

drop policy if exists "Farid updates approved experiment submission" on public.plan_submissions;
create policy "Farid updates approved experiment submission" on public.plan_submissions
for update to authenticated
using (private.is_farid_experiment() and teacher_id = (select auth.uid()))
with check (private.is_farid_experiment() and teacher_id = (select auth.uid()) and status in ('draft', 'approved'));
