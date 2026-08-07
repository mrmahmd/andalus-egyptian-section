-- The Farid test follows the real review flow: submit first, then
-- Mahmoud Helmy approves it before the family plan is published.
drop policy if exists "Farid publishes experiment plans" on public.weekly_plans;
drop policy if exists "Farid creates approved experiment submission" on public.plan_submissions;
drop policy if exists "Farid updates approved experiment submission" on public.plan_submissions;
