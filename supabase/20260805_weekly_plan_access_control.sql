create table if not exists public.weekly_plan_access_control (
  id integer primary key default 1 check (id = 1),
  is_open boolean not null default true,
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_plan_teacher_access (
  teacher_id uuid primary key references public.profiles(user_id) on delete cascade,
  is_open boolean not null,
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.weekly_plan_access_control (id, is_open)
values (1, true)
on conflict (id) do nothing;

alter table public.weekly_plan_access_control enable row level security;
alter table public.weekly_plan_teacher_access enable row level security;

create or replace function private.can_manage_weekly_plan_access()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    left join public.staff_directory s on s.id = p.staff_id
    where p.user_id = (select auth.uid())
      and p.status = 'active'
      and (p.role = 'super_admin' or s.full_name = 'أحمد حجازي')
  );
$$;

drop policy if exists "Staff read weekly plan access" on public.weekly_plan_access_control;
create policy "Staff read weekly plan access" on public.weekly_plan_access_control
for select to authenticated using (true);

drop policy if exists "Managers update weekly plan access" on public.weekly_plan_access_control;
create policy "Managers update weekly plan access" on public.weekly_plan_access_control
for all to authenticated using (private.can_manage_weekly_plan_access()) with check (private.can_manage_weekly_plan_access());

drop policy if exists "Staff read teacher plan access" on public.weekly_plan_teacher_access;
create policy "Staff read teacher plan access" on public.weekly_plan_teacher_access
for select to authenticated using (true);

drop policy if exists "Managers update teacher plan access" on public.weekly_plan_teacher_access;
create policy "Managers update teacher plan access" on public.weekly_plan_teacher_access
for all to authenticated using (private.can_manage_weekly_plan_access()) with check (private.can_manage_weekly_plan_access());

grant select on public.weekly_plan_access_control, public.weekly_plan_teacher_access to authenticated;
grant insert, update, delete on public.weekly_plan_access_control, public.weekly_plan_teacher_access to authenticated;
