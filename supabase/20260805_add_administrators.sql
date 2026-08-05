-- Add approved administrative staff who may create their own platform accounts.
-- Idempotent: safe to run more than once in Supabase SQL Editor.
insert into public.staff_directory (full_name, account_kind, administrative_role, is_active)
values
  ('علاء فتحي', 'admin', 'Administrator', true),
  ('محمد عبد القادر', 'admin', 'Administrator', true)
on conflict (full_name, account_kind) do update
set administrative_role = excluded.administrative_role,
    is_active = true;
